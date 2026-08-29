var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/app.ts
import express from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";

// src/lib/auth.ts
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

// src/lib/prisma.ts
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";

// generated/prisma/client.ts
import * as path from "path";
import { fileURLToPath } from "url";

// generated/prisma/internal/class.ts
import * as runtime from "@prisma/client/runtime/client";
var config = {
  "previewFeatures": [],
  "clientVersion": "7.8.0",
  "engineVersion": "3c6e192761c0362d496ed980de936e2f3cebcd3a",
  "activeProvider": "postgresql",
  "inlineSchema": '// This is your Prisma schema file,\n// learn more about it in the docs: https://pris.ly/d/prisma-schema\n\n// Get a free hosted Postgres database in seconds: `npx create-db`\n\ngenerator client {\n  provider = "prisma-client"\n  output   = "../generated/prisma"\n}\n\ndatasource db {\n  provider = "postgresql"\n}\n\n// ==============================\n// ENUMS\n// ==============================\n\nenum SystemRole {\n  ADMIN\n  STUDENT\n  TEACHER\n}\n\nenum HubRole {\n  TEACHER\n  CR\n  TA\n  STUDENT\n}\n\nenum AssessmentType {\n  ASSIGNMENT\n  QUIZ\n  PRESENTATION\n}\n\nenum SubmissionType {\n  ONLINE\n  HAND\n}\n\nenum BloodGroup {\n  A_POSITIVE\n  A_NEGATIVE\n  B_POSITIVE\n  B_NEGATIVE\n  AB_POSITIVE\n  AB_NEGATIVE\n  O_POSITIVE\n  O_NEGATIVE\n}\n\nenum CalendarStatus {\n  DRAFT\n  PUBLISHED\n  ARCHIVED\n}\n\nenum EventCategory {\n  CLASS\n  REGISTRATION\n  DEADLINE\n  EXAM\n  HOLIDAY\n  MAKEUP_CLASS\n  RESULT\n  ACADEMIC\n  OTHER\n}\n\n// ==============================\n// BETTER AUTH CORE SCHEMAS\n// ==============================\n\nmodel User {\n  id            String      @id @default(uuid())\n  email         String      @unique\n  emailVerified Boolean     @default(false)\n  name          String\n  image         String?\n  role          SystemRole?\n  phoneNumber   String?\n  bloodGroup    BloodGroup?\n\n  // Better Auth Relations\n  sessions Session[]\n  accounts Account[]\n\n  // 1-to-1 Profiles\n  studentProfile StudentProfile?\n  teacherProfile TeacherProfile?\n\n  // App Relations\n  hubs          HubMember[]\n  resources     Resource[]\n  createdTasks  Assessment[]   @relation("CreatedAssessments")\n  submissions   Submission[]\n  gradedWork    Submission[]   @relation("GradedSubmissions")\n  helpPosts     HelpPost[]\n  helpResponses HelpResponse[]\n  bloodPosts    BloodPost[]\n  reviews       CourseReview[]\n\n  createdAt            DateTime              @default(now())\n  updatedAt            DateTime              @updatedAt\n  bloodResponses       BloodResponse[]\n  complaints           Complaint[]\n  fieldBookings        FieldBooking[]\n  hubAnnouncements     HubAnnouncement[]\n  hubDiscussions       HubDiscussion[]\n  hubDiscussionReplies HubDiscussionReply[]\n  announcementComments AnnouncementComment[]\n\n  @@map("user")\n}\n\nmodel Session {\n  id        String   @id @default(uuid())\n  userId    String\n  token     String   @unique\n  expiresAt DateTime\n  ipAddress String?\n  userAgent String?\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)\n\n  @@index([userId])\n  @@map("session")\n}\n\nmodel Account {\n  id                    String    @id @default(uuid())\n  userId                String\n  accountId             String\n  providerId            String\n  accessToken           String?\n  refreshToken          String?\n  idToken               String?\n  accessTokenExpiresAt  DateTime?\n  refreshTokenExpiresAt DateTime?\n  scope                 String?\n  password              String? // Hashed password for credentials provider\n  createdAt             DateTime  @default(now())\n  updatedAt             DateTime  @updatedAt\n  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)\n\n  @@index([userId])\n  @@map("account")\n}\n\nmodel Verification {\n  id         String   @id @default(uuid())\n  identifier String\n  value      String\n  expiresAt  DateTime\n  createdAt  DateTime @default(now())\n  updatedAt  DateTime @updatedAt\n\n  @@index([identifier])\n  @@map("verification")\n}\n\n// ==============================\n// ROLE-SPECIFIC PROFILES\n// ==============================\n\nmodel StudentProfile {\n  id        String @id @default(uuid())\n  userId    String @unique\n  studentId String @unique\n\n  faculty         String\n  department      String\n  program         String\n  batch           String\n  currentSemester Int\n  section         String\n\n  isCR Boolean @default(false)\n  isTA Boolean @default(false)\n\n  skills             String[]\n  linkedInUrl        String?\n  personalWebsiteUrl String?\n\n  user User @relation(fields: [userId], references: [id], onDelete: Cascade)\n}\n\nmodel TeacherProfile {\n  id        String @id @default(uuid())\n  userId    String @unique\n  teacherId String @unique\n\n  designation String\n  department  String\n  faculty     String\n\n  officeRoom        String?\n  consultationHours String?\n\n  expertiseFields        String[]\n  academicQualifications Json?\n\n  linkedInUrl        String?\n  personalWebsiteUrl String?\n\n  user User @relation(fields: [userId], references: [id], onDelete: Cascade)\n}\n\n// ==============================\n// COURSE HUB MODULE\n// ==============================\n\nmodel CourseHub {\n  id                  String  @id @default(uuid())\n  courseCode          String\n  courseName          String\n  credit              Float\n  termOffer           String\n  weeklyClassSchedule Json\n  termExams           Json? // \u{1F448} NEW: Consolidated exam data\n  joinCode            String  @unique\n  isArchived          Boolean @default(false)\n  department          String\n  batch               String\n  semesterNumber      Int\n\n  isReviewOpen    Boolean @default(false)\n  reviewQuestions Json?\n\n  members       HubMember[]\n  resources     Resource[]\n  assessments   Assessment[]\n  reviews       CourseReview[]\n  announcements HubAnnouncement[]\n  discussions   HubDiscussion[]\n\n  createdAt DateTime @default(now())\n}\n\nmodel HubMember {\n  id       String  @id @default(uuid())\n  userId   String\n  hubId    String\n  role     HubRole\n  isActive Boolean @default(true)\n\n  user User      @relation(fields: [userId], references: [id], onDelete: Cascade)\n  hub  CourseHub @relation(fields: [hubId], references: [id], onDelete: Cascade)\n\n  @@unique([userId, hubId])\n  @@index([hubId])\n  @@index([userId])\n}\n\n// ==============================\n// HUB ANNOUNCEMENTS & DISCUSSIONS\n// ==============================\n\nmodel HubAnnouncement {\n  id                String   @id @default(uuid())\n  hubId             String\n  creatorId         String\n  content           String\n  attachedLinkUrl   String? // \u{1F448} NEW\n  attachedLinkTitle String? // \u{1F448} NEW\n  createdAt         DateTime @default(now())\n\n  hub      CourseHub             @relation(fields: [hubId], references: [id], onDelete: Cascade)\n  creator  User                  @relation(fields: [creatorId], references: [id], onDelete: Cascade)\n  comments AnnouncementComment[] // \u{1F448} NEW\n\n  @@index([hubId])\n}\n\nmodel AnnouncementComment {\n  id             String   @id @default(uuid())\n  content        String\n  announcementId String\n  authorId       String\n  createdAt      DateTime @default(now())\n\n  announcement HubAnnouncement @relation(fields: [announcementId], references: [id], onDelete: Cascade)\n  author       User            @relation(fields: [authorId], references: [id], onDelete: Cascade)\n\n  @@index([announcementId])\n}\n\nmodel HubDiscussion {\n  id        String   @id @default(uuid())\n  hubId     String\n  authorId  String\n  title     String\n  content   String\n  createdAt DateTime @default(now())\n\n  hub     CourseHub            @relation(fields: [hubId], references: [id], onDelete: Cascade)\n  author  User                 @relation(fields: [authorId], references: [id], onDelete: Cascade)\n  replies HubDiscussionReply[]\n\n  @@index([hubId])\n}\n\nmodel HubDiscussionReply {\n  id           String   @id @default(uuid())\n  discussionId String\n  authorId     String\n  content      String\n  createdAt    DateTime @default(now())\n\n  discussion HubDiscussion @relation(fields: [discussionId], references: [id], onDelete: Cascade)\n  author     User          @relation(fields: [authorId], references: [id], onDelete: Cascade)\n\n  @@index([discussionId])\n}\n\n// ==============================\n// ASSESSMENTS & GRADING\n// ==============================\n\nmodel Assessment {\n  id             String          @id @default(uuid())\n  hubId          String\n  creatorId      String?\n  title          String\n  description    String?\n  type           AssessmentType\n  submissionType SubmissionType?\n  deadline       DateTime\n  totalMarks     Float\n\n  hub         CourseHub    @relation(fields: [hubId], references: [id], onDelete: Cascade)\n  creator     User?        @relation("CreatedAssessments", fields: [creatorId], references: [id], onDelete: SetNull)\n  submissions Submission[]\n  createdAt   DateTime     @default(now())\n\n  @@index([hubId])\n}\n\nmodel Submission {\n  id           String  @id @default(uuid())\n  assessmentId String\n  studentId    String\n  submittedUrl String?\n  marks        Float?\n  gradedById   String?\n\n  assessment Assessment @relation(fields: [assessmentId], references: [id], onDelete: Cascade)\n  student    User       @relation(fields: [studentId], references: [id], onDelete: Cascade)\n  gradedBy   User?      @relation("GradedSubmissions", fields: [gradedById], references: [id])\n  createdAt  DateTime   @default(now())\n\n  @@unique([assessmentId, studentId])\n  @@index([assessmentId])\n}\n\n// ==============================\n// RESOURCES & DIGITAL VAULT\n// ==============================\n\nmodel Resource {\n  id            String  @id @default(uuid())\n  title         String\n  driveUrl      String\n  uploaderId    String\n  hubId         String? // If Null -> Global Vault. If present -> Local Hub\n  isStudentNote Boolean @default(false)\n  rating        Float   @default(0) // Vault Promotion Threshold\n\n  uploader  User       @relation(fields: [uploaderId], references: [id], onDelete: Cascade)\n  hub       CourseHub? @relation(fields: [hubId], references: [id], onDelete: Cascade)\n  createdAt DateTime   @default(now())\n\n  @@index([hubId])\n}\n\n// ==============================\n// COMMUNITY & POSTS\n// ==============================\n\nmodel HelpPost {\n  id          String         @id @default(uuid())\n  authorId    String\n  title       String\n  description String\n  isResolved  Boolean        @default(false)\n  author      User           @relation(fields: [authorId], references: [id], onDelete: Cascade)\n  responses   HelpResponse[]\n  createdAt   DateTime       @default(now())\n\n  @@index([authorId])\n}\n\nmodel HelpResponse {\n  id          String   @id @default(uuid())\n  postId      String\n  responderId String\n  content     String\n  post        HelpPost @relation(fields: [postId], references: [id], onDelete: Cascade)\n  responder   User     @relation(fields: [responderId], references: [id], onDelete: Cascade)\n  createdAt   DateTime @default(now())\n}\n\nmodel BloodPost {\n  id               String          @id @default(uuid())\n  authorId         String\n  patientName      String\n  patientCondition String\n  bloodGroup       BloodGroup\n  location         String\n  urgency          String\n  contactPhone     String\n  isFulfilled      Boolean         @default(false)\n  author           User            @relation(fields: [authorId], references: [id], onDelete: Cascade)\n  responses        BloodResponse[]\n  createdAt        DateTime        @default(now())\n\n  @@index([authorId])\n}\n\nmodel BloodResponse {\n  id          String  @id @default(uuid())\n  postId      String\n  responderId String\n  message     String? // Optional short message like "I am nearby and can come now"\n\n  post      BloodPost @relation(fields: [postId], references: [id], onDelete: Cascade)\n  responder User      @relation(fields: [responderId], references: [id], onDelete: Cascade)\n  createdAt DateTime  @default(now())\n\n  @@index([postId])\n  @@index([responderId])\n}\n\n// ==============================\n// RATINGS & GLOBAL ADMIN\n// ==============================\n\nmodel CourseReview {\n  id          String  @id @default(uuid())\n  hubId       String\n  studentId   String\n  rating      Int\n  comment     String?\n  isAnonymous Boolean @default(true)\n  answers     Json?\n\n  hub       CourseHub @relation(fields: [hubId], references: [id], onDelete: Cascade)\n  student   User      @relation(fields: [studentId], references: [id], onDelete: Cascade)\n  createdAt DateTime  @default(now())\n\n  @@unique([hubId, studentId]) // One review per student per hub\n  @@index([hubId])\n}\n\nmodel BusSchedule {\n  id            String   @id @default(uuid())\n  route         String\n  busNumber     String\n  departureTime String\n  stops         String[]\n  createdAt     DateTime @default(now())\n}\n\n// ==============================\n// ACADEMIC CALENDAR MODULE\n// ==============================\n\nmodel AcademicCalendar {\n  id                String          @id @default(uuid())\n  title             String\n  semester          String\n  academicYear      Int             @default(2026)\n  status            CalendarStatus  @default(DRAFT)\n  isActive          Boolean         @default(true)\n  isGlobal          Boolean         @default(false)\n  targetFaculties   String[]\n  targetDepartments String[]\n  publishedAt       DateTime?\n  createdBy         String?\n  updatedBy         String?\n  events            CalendarEvent[]\n  createdAt         DateTime        @default(now())\n  updatedAt         DateTime        @default(now()) @updatedAt\n}\n\nmodel CalendarEvent {\n  id          String           @id @default(uuid())\n  calendarId  String\n  calendar    AcademicCalendar @relation(fields: [calendarId], references: [id], onDelete: Cascade)\n  title       String\n  description String?\n  category    EventCategory    @default(ACADEMIC)\n  startDate   DateTime\n  endDate     DateTime?\n  weekNumber  Int?\n  isHoliday   Boolean          @default(false)\n  isAllDay    Boolean          @default(true)\n  remarks     String?\n  createdAt   DateTime         @default(now())\n  updatedAt   DateTime         @default(now()) @updatedAt\n\n  @@index([calendarId])\n  @@index([startDate])\n}\n\n// ==============================\n// GLOBAL NOTICEBOARD & EVENTS\n// ==============================\n\nmodel Notice {\n  id                String   @id @default(uuid())\n  referenceNo       String?\n  title             String\n  body              String\n  issuerName        String\n  issuerDesignation String\n  copyTo            String[]\n\n  issueDate DateTime @default(now())\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n}\n\nmodel CampusEvent {\n  id          String   @id @default(uuid())\n  title       String\n  description String?\n  location    String? // e.g., "Auditorium", "Permanent Campus Ground"\n  eventDate   DateTime // Admin specified date and time\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n}\n\n// ==============================\n// COMPLAINTS MANAGEMENT\n// ==============================\nenum ComplaintStatus {\n  PENDING\n  RESOLVED\n  REJECTED\n}\n\nmodel Complaint {\n  id          String          @id @default(uuid())\n  userId      String\n  title       String\n  description String\n  category    String // e.g., "Facilities", "Academic", "Hostel", "Other"\n  status      ComplaintStatus @default(PENDING)\n  createdAt   DateTime        @default(now())\n  updatedAt   DateTime        @updatedAt\n\n  user User @relation(fields: [userId], references: [id], onDelete: Cascade)\n\n  @@index([userId])\n}\n\n// ==============================\n// ALUMNI DIRECTORY\n// ==============================\nmodel Alumni {\n  id                 String   @id @default(uuid())\n  name               String\n  email              String?\n  batch              String\n  graduationYear     Int\n  department         String\n  degree             String?\n  currentCompany     String?\n  currentPosition    String?\n  skills             String[]\n  linkedInUrl        String?\n  personalWebsiteUrl String?\n  image              String?\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n}\n\n// ==============================\n// FIELD BOOKING\n// ==============================\nenum BookingStatus {\n  PENDING\n  APPROVED\n  REJECTED\n}\n\nmodel FieldBooking {\n  id          String        @id @default(uuid())\n  userId      String\n  purpose     String // e.g., "CSE Dept Football Practice"\n  bookingDate DateTime\n  startTime   DateTime\n  endTime     DateTime\n  status      BookingStatus @default(PENDING)\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  user User @relation(fields: [userId], references: [id], onDelete: Cascade)\n\n  @@index([userId])\n  @@index([status, bookingDate])\n}\n\n// A single row table to control if the field is open or closed globally\nmodel FieldSetting {\n  id            String   @id @default(uuid())\n  isBookingOpen Boolean  @default(true)\n  closedNotice  String? // The notice shown when booking is disabled\n  updatedAt     DateTime @updatedAt\n}\n',
  "runtimeDataModel": {
    "models": {},
    "enums": {},
    "types": {}
  },
  "parameterizationSchema": {
    "strings": [],
    "graph": ""
  }
};
config.runtimeDataModel = JSON.parse('{"models":{"User":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"email","kind":"scalar","type":"String"},{"name":"emailVerified","kind":"scalar","type":"Boolean"},{"name":"name","kind":"scalar","type":"String"},{"name":"image","kind":"scalar","type":"String"},{"name":"role","kind":"enum","type":"SystemRole"},{"name":"phoneNumber","kind":"scalar","type":"String"},{"name":"bloodGroup","kind":"enum","type":"BloodGroup"},{"name":"sessions","kind":"object","type":"Session","relationName":"SessionToUser"},{"name":"accounts","kind":"object","type":"Account","relationName":"AccountToUser"},{"name":"studentProfile","kind":"object","type":"StudentProfile","relationName":"StudentProfileToUser"},{"name":"teacherProfile","kind":"object","type":"TeacherProfile","relationName":"TeacherProfileToUser"},{"name":"hubs","kind":"object","type":"HubMember","relationName":"HubMemberToUser"},{"name":"resources","kind":"object","type":"Resource","relationName":"ResourceToUser"},{"name":"createdTasks","kind":"object","type":"Assessment","relationName":"CreatedAssessments"},{"name":"submissions","kind":"object","type":"Submission","relationName":"SubmissionToUser"},{"name":"gradedWork","kind":"object","type":"Submission","relationName":"GradedSubmissions"},{"name":"helpPosts","kind":"object","type":"HelpPost","relationName":"HelpPostToUser"},{"name":"helpResponses","kind":"object","type":"HelpResponse","relationName":"HelpResponseToUser"},{"name":"bloodPosts","kind":"object","type":"BloodPost","relationName":"BloodPostToUser"},{"name":"reviews","kind":"object","type":"CourseReview","relationName":"CourseReviewToUser"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"bloodResponses","kind":"object","type":"BloodResponse","relationName":"BloodResponseToUser"},{"name":"complaints","kind":"object","type":"Complaint","relationName":"ComplaintToUser"},{"name":"fieldBookings","kind":"object","type":"FieldBooking","relationName":"FieldBookingToUser"},{"name":"hubAnnouncements","kind":"object","type":"HubAnnouncement","relationName":"HubAnnouncementToUser"},{"name":"hubDiscussions","kind":"object","type":"HubDiscussion","relationName":"HubDiscussionToUser"},{"name":"hubDiscussionReplies","kind":"object","type":"HubDiscussionReply","relationName":"HubDiscussionReplyToUser"},{"name":"announcementComments","kind":"object","type":"AnnouncementComment","relationName":"AnnouncementCommentToUser"}],"dbName":"user"},"Session":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"String"},{"name":"token","kind":"scalar","type":"String"},{"name":"expiresAt","kind":"scalar","type":"DateTime"},{"name":"ipAddress","kind":"scalar","type":"String"},{"name":"userAgent","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"user","kind":"object","type":"User","relationName":"SessionToUser"}],"dbName":"session"},"Account":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"String"},{"name":"accountId","kind":"scalar","type":"String"},{"name":"providerId","kind":"scalar","type":"String"},{"name":"accessToken","kind":"scalar","type":"String"},{"name":"refreshToken","kind":"scalar","type":"String"},{"name":"idToken","kind":"scalar","type":"String"},{"name":"accessTokenExpiresAt","kind":"scalar","type":"DateTime"},{"name":"refreshTokenExpiresAt","kind":"scalar","type":"DateTime"},{"name":"scope","kind":"scalar","type":"String"},{"name":"password","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"user","kind":"object","type":"User","relationName":"AccountToUser"}],"dbName":"account"},"Verification":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"identifier","kind":"scalar","type":"String"},{"name":"value","kind":"scalar","type":"String"},{"name":"expiresAt","kind":"scalar","type":"DateTime"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"}],"dbName":"verification"},"StudentProfile":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"String"},{"name":"studentId","kind":"scalar","type":"String"},{"name":"faculty","kind":"scalar","type":"String"},{"name":"department","kind":"scalar","type":"String"},{"name":"program","kind":"scalar","type":"String"},{"name":"batch","kind":"scalar","type":"String"},{"name":"currentSemester","kind":"scalar","type":"Int"},{"name":"section","kind":"scalar","type":"String"},{"name":"isCR","kind":"scalar","type":"Boolean"},{"name":"isTA","kind":"scalar","type":"Boolean"},{"name":"skills","kind":"scalar","type":"String"},{"name":"linkedInUrl","kind":"scalar","type":"String"},{"name":"personalWebsiteUrl","kind":"scalar","type":"String"},{"name":"user","kind":"object","type":"User","relationName":"StudentProfileToUser"}],"dbName":null},"TeacherProfile":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"String"},{"name":"teacherId","kind":"scalar","type":"String"},{"name":"designation","kind":"scalar","type":"String"},{"name":"department","kind":"scalar","type":"String"},{"name":"faculty","kind":"scalar","type":"String"},{"name":"officeRoom","kind":"scalar","type":"String"},{"name":"consultationHours","kind":"scalar","type":"String"},{"name":"expertiseFields","kind":"scalar","type":"String"},{"name":"academicQualifications","kind":"scalar","type":"Json"},{"name":"linkedInUrl","kind":"scalar","type":"String"},{"name":"personalWebsiteUrl","kind":"scalar","type":"String"},{"name":"user","kind":"object","type":"User","relationName":"TeacherProfileToUser"}],"dbName":null},"CourseHub":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"courseCode","kind":"scalar","type":"String"},{"name":"courseName","kind":"scalar","type":"String"},{"name":"credit","kind":"scalar","type":"Float"},{"name":"termOffer","kind":"scalar","type":"String"},{"name":"weeklyClassSchedule","kind":"scalar","type":"Json"},{"name":"termExams","kind":"scalar","type":"Json"},{"name":"joinCode","kind":"scalar","type":"String"},{"name":"isArchived","kind":"scalar","type":"Boolean"},{"name":"department","kind":"scalar","type":"String"},{"name":"batch","kind":"scalar","type":"String"},{"name":"semesterNumber","kind":"scalar","type":"Int"},{"name":"isReviewOpen","kind":"scalar","type":"Boolean"},{"name":"reviewQuestions","kind":"scalar","type":"Json"},{"name":"members","kind":"object","type":"HubMember","relationName":"CourseHubToHubMember"},{"name":"resources","kind":"object","type":"Resource","relationName":"CourseHubToResource"},{"name":"assessments","kind":"object","type":"Assessment","relationName":"AssessmentToCourseHub"},{"name":"reviews","kind":"object","type":"CourseReview","relationName":"CourseHubToCourseReview"},{"name":"announcements","kind":"object","type":"HubAnnouncement","relationName":"CourseHubToHubAnnouncement"},{"name":"discussions","kind":"object","type":"HubDiscussion","relationName":"CourseHubToHubDiscussion"},{"name":"createdAt","kind":"scalar","type":"DateTime"}],"dbName":null},"HubMember":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"String"},{"name":"hubId","kind":"scalar","type":"String"},{"name":"role","kind":"enum","type":"HubRole"},{"name":"isActive","kind":"scalar","type":"Boolean"},{"name":"user","kind":"object","type":"User","relationName":"HubMemberToUser"},{"name":"hub","kind":"object","type":"CourseHub","relationName":"CourseHubToHubMember"}],"dbName":null},"HubAnnouncement":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"hubId","kind":"scalar","type":"String"},{"name":"creatorId","kind":"scalar","type":"String"},{"name":"content","kind":"scalar","type":"String"},{"name":"attachedLinkUrl","kind":"scalar","type":"String"},{"name":"attachedLinkTitle","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"hub","kind":"object","type":"CourseHub","relationName":"CourseHubToHubAnnouncement"},{"name":"creator","kind":"object","type":"User","relationName":"HubAnnouncementToUser"},{"name":"comments","kind":"object","type":"AnnouncementComment","relationName":"AnnouncementCommentToHubAnnouncement"}],"dbName":null},"AnnouncementComment":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"content","kind":"scalar","type":"String"},{"name":"announcementId","kind":"scalar","type":"String"},{"name":"authorId","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"announcement","kind":"object","type":"HubAnnouncement","relationName":"AnnouncementCommentToHubAnnouncement"},{"name":"author","kind":"object","type":"User","relationName":"AnnouncementCommentToUser"}],"dbName":null},"HubDiscussion":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"hubId","kind":"scalar","type":"String"},{"name":"authorId","kind":"scalar","type":"String"},{"name":"title","kind":"scalar","type":"String"},{"name":"content","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"hub","kind":"object","type":"CourseHub","relationName":"CourseHubToHubDiscussion"},{"name":"author","kind":"object","type":"User","relationName":"HubDiscussionToUser"},{"name":"replies","kind":"object","type":"HubDiscussionReply","relationName":"HubDiscussionToHubDiscussionReply"}],"dbName":null},"HubDiscussionReply":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"discussionId","kind":"scalar","type":"String"},{"name":"authorId","kind":"scalar","type":"String"},{"name":"content","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"discussion","kind":"object","type":"HubDiscussion","relationName":"HubDiscussionToHubDiscussionReply"},{"name":"author","kind":"object","type":"User","relationName":"HubDiscussionReplyToUser"}],"dbName":null},"Assessment":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"hubId","kind":"scalar","type":"String"},{"name":"creatorId","kind":"scalar","type":"String"},{"name":"title","kind":"scalar","type":"String"},{"name":"description","kind":"scalar","type":"String"},{"name":"type","kind":"enum","type":"AssessmentType"},{"name":"submissionType","kind":"enum","type":"SubmissionType"},{"name":"deadline","kind":"scalar","type":"DateTime"},{"name":"totalMarks","kind":"scalar","type":"Float"},{"name":"hub","kind":"object","type":"CourseHub","relationName":"AssessmentToCourseHub"},{"name":"creator","kind":"object","type":"User","relationName":"CreatedAssessments"},{"name":"submissions","kind":"object","type":"Submission","relationName":"AssessmentToSubmission"},{"name":"createdAt","kind":"scalar","type":"DateTime"}],"dbName":null},"Submission":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"assessmentId","kind":"scalar","type":"String"},{"name":"studentId","kind":"scalar","type":"String"},{"name":"submittedUrl","kind":"scalar","type":"String"},{"name":"marks","kind":"scalar","type":"Float"},{"name":"gradedById","kind":"scalar","type":"String"},{"name":"assessment","kind":"object","type":"Assessment","relationName":"AssessmentToSubmission"},{"name":"student","kind":"object","type":"User","relationName":"SubmissionToUser"},{"name":"gradedBy","kind":"object","type":"User","relationName":"GradedSubmissions"},{"name":"createdAt","kind":"scalar","type":"DateTime"}],"dbName":null},"Resource":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"title","kind":"scalar","type":"String"},{"name":"driveUrl","kind":"scalar","type":"String"},{"name":"uploaderId","kind":"scalar","type":"String"},{"name":"hubId","kind":"scalar","type":"String"},{"name":"isStudentNote","kind":"scalar","type":"Boolean"},{"name":"rating","kind":"scalar","type":"Float"},{"name":"uploader","kind":"object","type":"User","relationName":"ResourceToUser"},{"name":"hub","kind":"object","type":"CourseHub","relationName":"CourseHubToResource"},{"name":"createdAt","kind":"scalar","type":"DateTime"}],"dbName":null},"HelpPost":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"authorId","kind":"scalar","type":"String"},{"name":"title","kind":"scalar","type":"String"},{"name":"description","kind":"scalar","type":"String"},{"name":"isResolved","kind":"scalar","type":"Boolean"},{"name":"author","kind":"object","type":"User","relationName":"HelpPostToUser"},{"name":"responses","kind":"object","type":"HelpResponse","relationName":"HelpPostToHelpResponse"},{"name":"createdAt","kind":"scalar","type":"DateTime"}],"dbName":null},"HelpResponse":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"postId","kind":"scalar","type":"String"},{"name":"responderId","kind":"scalar","type":"String"},{"name":"content","kind":"scalar","type":"String"},{"name":"post","kind":"object","type":"HelpPost","relationName":"HelpPostToHelpResponse"},{"name":"responder","kind":"object","type":"User","relationName":"HelpResponseToUser"},{"name":"createdAt","kind":"scalar","type":"DateTime"}],"dbName":null},"BloodPost":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"authorId","kind":"scalar","type":"String"},{"name":"patientName","kind":"scalar","type":"String"},{"name":"patientCondition","kind":"scalar","type":"String"},{"name":"bloodGroup","kind":"enum","type":"BloodGroup"},{"name":"location","kind":"scalar","type":"String"},{"name":"urgency","kind":"scalar","type":"String"},{"name":"contactPhone","kind":"scalar","type":"String"},{"name":"isFulfilled","kind":"scalar","type":"Boolean"},{"name":"author","kind":"object","type":"User","relationName":"BloodPostToUser"},{"name":"responses","kind":"object","type":"BloodResponse","relationName":"BloodPostToBloodResponse"},{"name":"createdAt","kind":"scalar","type":"DateTime"}],"dbName":null},"BloodResponse":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"postId","kind":"scalar","type":"String"},{"name":"responderId","kind":"scalar","type":"String"},{"name":"message","kind":"scalar","type":"String"},{"name":"post","kind":"object","type":"BloodPost","relationName":"BloodPostToBloodResponse"},{"name":"responder","kind":"object","type":"User","relationName":"BloodResponseToUser"},{"name":"createdAt","kind":"scalar","type":"DateTime"}],"dbName":null},"CourseReview":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"hubId","kind":"scalar","type":"String"},{"name":"studentId","kind":"scalar","type":"String"},{"name":"rating","kind":"scalar","type":"Int"},{"name":"comment","kind":"scalar","type":"String"},{"name":"isAnonymous","kind":"scalar","type":"Boolean"},{"name":"answers","kind":"scalar","type":"Json"},{"name":"hub","kind":"object","type":"CourseHub","relationName":"CourseHubToCourseReview"},{"name":"student","kind":"object","type":"User","relationName":"CourseReviewToUser"},{"name":"createdAt","kind":"scalar","type":"DateTime"}],"dbName":null},"BusSchedule":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"route","kind":"scalar","type":"String"},{"name":"busNumber","kind":"scalar","type":"String"},{"name":"departureTime","kind":"scalar","type":"String"},{"name":"stops","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"}],"dbName":null},"AcademicCalendar":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"title","kind":"scalar","type":"String"},{"name":"semester","kind":"scalar","type":"String"},{"name":"academicYear","kind":"scalar","type":"Int"},{"name":"status","kind":"enum","type":"CalendarStatus"},{"name":"isActive","kind":"scalar","type":"Boolean"},{"name":"isGlobal","kind":"scalar","type":"Boolean"},{"name":"targetFaculties","kind":"scalar","type":"String"},{"name":"targetDepartments","kind":"scalar","type":"String"},{"name":"publishedAt","kind":"scalar","type":"DateTime"},{"name":"createdBy","kind":"scalar","type":"String"},{"name":"updatedBy","kind":"scalar","type":"String"},{"name":"events","kind":"object","type":"CalendarEvent","relationName":"AcademicCalendarToCalendarEvent"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"}],"dbName":null},"CalendarEvent":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"calendarId","kind":"scalar","type":"String"},{"name":"calendar","kind":"object","type":"AcademicCalendar","relationName":"AcademicCalendarToCalendarEvent"},{"name":"title","kind":"scalar","type":"String"},{"name":"description","kind":"scalar","type":"String"},{"name":"category","kind":"enum","type":"EventCategory"},{"name":"startDate","kind":"scalar","type":"DateTime"},{"name":"endDate","kind":"scalar","type":"DateTime"},{"name":"weekNumber","kind":"scalar","type":"Int"},{"name":"isHoliday","kind":"scalar","type":"Boolean"},{"name":"isAllDay","kind":"scalar","type":"Boolean"},{"name":"remarks","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"}],"dbName":null},"Notice":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"referenceNo","kind":"scalar","type":"String"},{"name":"title","kind":"scalar","type":"String"},{"name":"body","kind":"scalar","type":"String"},{"name":"issuerName","kind":"scalar","type":"String"},{"name":"issuerDesignation","kind":"scalar","type":"String"},{"name":"copyTo","kind":"scalar","type":"String"},{"name":"issueDate","kind":"scalar","type":"DateTime"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"}],"dbName":null},"CampusEvent":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"title","kind":"scalar","type":"String"},{"name":"description","kind":"scalar","type":"String"},{"name":"location","kind":"scalar","type":"String"},{"name":"eventDate","kind":"scalar","type":"DateTime"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"}],"dbName":null},"Complaint":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"String"},{"name":"title","kind":"scalar","type":"String"},{"name":"description","kind":"scalar","type":"String"},{"name":"category","kind":"scalar","type":"String"},{"name":"status","kind":"enum","type":"ComplaintStatus"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"user","kind":"object","type":"User","relationName":"ComplaintToUser"}],"dbName":null},"Alumni":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"name","kind":"scalar","type":"String"},{"name":"email","kind":"scalar","type":"String"},{"name":"batch","kind":"scalar","type":"String"},{"name":"graduationYear","kind":"scalar","type":"Int"},{"name":"department","kind":"scalar","type":"String"},{"name":"degree","kind":"scalar","type":"String"},{"name":"currentCompany","kind":"scalar","type":"String"},{"name":"currentPosition","kind":"scalar","type":"String"},{"name":"skills","kind":"scalar","type":"String"},{"name":"linkedInUrl","kind":"scalar","type":"String"},{"name":"personalWebsiteUrl","kind":"scalar","type":"String"},{"name":"image","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"}],"dbName":null},"FieldBooking":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"String"},{"name":"purpose","kind":"scalar","type":"String"},{"name":"bookingDate","kind":"scalar","type":"DateTime"},{"name":"startTime","kind":"scalar","type":"DateTime"},{"name":"endTime","kind":"scalar","type":"DateTime"},{"name":"status","kind":"enum","type":"BookingStatus"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"user","kind":"object","type":"User","relationName":"FieldBookingToUser"}],"dbName":null},"FieldSetting":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"isBookingOpen","kind":"scalar","type":"Boolean"},{"name":"closedNotice","kind":"scalar","type":"String"},{"name":"updatedAt","kind":"scalar","type":"DateTime"}],"dbName":null}},"enums":{},"types":{}}');
config.parameterizationSchema = {
  strings: JSON.parse('["where","orderBy","cursor","user","sessions","accounts","studentProfile","teacherProfile","members","uploader","hub","resources","creator","assessment","student","gradedBy","submissions","_count","assessments","reviews","announcement","author","comments","announcements","discussion","replies","discussions","hubs","createdTasks","gradedWork","post","responder","responses","helpPosts","helpResponses","bloodPosts","bloodResponses","complaints","fieldBookings","hubAnnouncements","hubDiscussions","hubDiscussionReplies","announcementComments","User.findUnique","User.findUniqueOrThrow","User.findFirst","User.findFirstOrThrow","User.findMany","data","User.createOne","User.createMany","User.createManyAndReturn","User.updateOne","User.updateMany","User.updateManyAndReturn","create","update","User.upsertOne","User.deleteOne","User.deleteMany","having","_min","_max","User.groupBy","User.aggregate","Session.findUnique","Session.findUniqueOrThrow","Session.findFirst","Session.findFirstOrThrow","Session.findMany","Session.createOne","Session.createMany","Session.createManyAndReturn","Session.updateOne","Session.updateMany","Session.updateManyAndReturn","Session.upsertOne","Session.deleteOne","Session.deleteMany","Session.groupBy","Session.aggregate","Account.findUnique","Account.findUniqueOrThrow","Account.findFirst","Account.findFirstOrThrow","Account.findMany","Account.createOne","Account.createMany","Account.createManyAndReturn","Account.updateOne","Account.updateMany","Account.updateManyAndReturn","Account.upsertOne","Account.deleteOne","Account.deleteMany","Account.groupBy","Account.aggregate","Verification.findUnique","Verification.findUniqueOrThrow","Verification.findFirst","Verification.findFirstOrThrow","Verification.findMany","Verification.createOne","Verification.createMany","Verification.createManyAndReturn","Verification.updateOne","Verification.updateMany","Verification.updateManyAndReturn","Verification.upsertOne","Verification.deleteOne","Verification.deleteMany","Verification.groupBy","Verification.aggregate","StudentProfile.findUnique","StudentProfile.findUniqueOrThrow","StudentProfile.findFirst","StudentProfile.findFirstOrThrow","StudentProfile.findMany","StudentProfile.createOne","StudentProfile.createMany","StudentProfile.createManyAndReturn","StudentProfile.updateOne","StudentProfile.updateMany","StudentProfile.updateManyAndReturn","StudentProfile.upsertOne","StudentProfile.deleteOne","StudentProfile.deleteMany","_avg","_sum","StudentProfile.groupBy","StudentProfile.aggregate","TeacherProfile.findUnique","TeacherProfile.findUniqueOrThrow","TeacherProfile.findFirst","TeacherProfile.findFirstOrThrow","TeacherProfile.findMany","TeacherProfile.createOne","TeacherProfile.createMany","TeacherProfile.createManyAndReturn","TeacherProfile.updateOne","TeacherProfile.updateMany","TeacherProfile.updateManyAndReturn","TeacherProfile.upsertOne","TeacherProfile.deleteOne","TeacherProfile.deleteMany","TeacherProfile.groupBy","TeacherProfile.aggregate","CourseHub.findUnique","CourseHub.findUniqueOrThrow","CourseHub.findFirst","CourseHub.findFirstOrThrow","CourseHub.findMany","CourseHub.createOne","CourseHub.createMany","CourseHub.createManyAndReturn","CourseHub.updateOne","CourseHub.updateMany","CourseHub.updateManyAndReturn","CourseHub.upsertOne","CourseHub.deleteOne","CourseHub.deleteMany","CourseHub.groupBy","CourseHub.aggregate","HubMember.findUnique","HubMember.findUniqueOrThrow","HubMember.findFirst","HubMember.findFirstOrThrow","HubMember.findMany","HubMember.createOne","HubMember.createMany","HubMember.createManyAndReturn","HubMember.updateOne","HubMember.updateMany","HubMember.updateManyAndReturn","HubMember.upsertOne","HubMember.deleteOne","HubMember.deleteMany","HubMember.groupBy","HubMember.aggregate","HubAnnouncement.findUnique","HubAnnouncement.findUniqueOrThrow","HubAnnouncement.findFirst","HubAnnouncement.findFirstOrThrow","HubAnnouncement.findMany","HubAnnouncement.createOne","HubAnnouncement.createMany","HubAnnouncement.createManyAndReturn","HubAnnouncement.updateOne","HubAnnouncement.updateMany","HubAnnouncement.updateManyAndReturn","HubAnnouncement.upsertOne","HubAnnouncement.deleteOne","HubAnnouncement.deleteMany","HubAnnouncement.groupBy","HubAnnouncement.aggregate","AnnouncementComment.findUnique","AnnouncementComment.findUniqueOrThrow","AnnouncementComment.findFirst","AnnouncementComment.findFirstOrThrow","AnnouncementComment.findMany","AnnouncementComment.createOne","AnnouncementComment.createMany","AnnouncementComment.createManyAndReturn","AnnouncementComment.updateOne","AnnouncementComment.updateMany","AnnouncementComment.updateManyAndReturn","AnnouncementComment.upsertOne","AnnouncementComment.deleteOne","AnnouncementComment.deleteMany","AnnouncementComment.groupBy","AnnouncementComment.aggregate","HubDiscussion.findUnique","HubDiscussion.findUniqueOrThrow","HubDiscussion.findFirst","HubDiscussion.findFirstOrThrow","HubDiscussion.findMany","HubDiscussion.createOne","HubDiscussion.createMany","HubDiscussion.createManyAndReturn","HubDiscussion.updateOne","HubDiscussion.updateMany","HubDiscussion.updateManyAndReturn","HubDiscussion.upsertOne","HubDiscussion.deleteOne","HubDiscussion.deleteMany","HubDiscussion.groupBy","HubDiscussion.aggregate","HubDiscussionReply.findUnique","HubDiscussionReply.findUniqueOrThrow","HubDiscussionReply.findFirst","HubDiscussionReply.findFirstOrThrow","HubDiscussionReply.findMany","HubDiscussionReply.createOne","HubDiscussionReply.createMany","HubDiscussionReply.createManyAndReturn","HubDiscussionReply.updateOne","HubDiscussionReply.updateMany","HubDiscussionReply.updateManyAndReturn","HubDiscussionReply.upsertOne","HubDiscussionReply.deleteOne","HubDiscussionReply.deleteMany","HubDiscussionReply.groupBy","HubDiscussionReply.aggregate","Assessment.findUnique","Assessment.findUniqueOrThrow","Assessment.findFirst","Assessment.findFirstOrThrow","Assessment.findMany","Assessment.createOne","Assessment.createMany","Assessment.createManyAndReturn","Assessment.updateOne","Assessment.updateMany","Assessment.updateManyAndReturn","Assessment.upsertOne","Assessment.deleteOne","Assessment.deleteMany","Assessment.groupBy","Assessment.aggregate","Submission.findUnique","Submission.findUniqueOrThrow","Submission.findFirst","Submission.findFirstOrThrow","Submission.findMany","Submission.createOne","Submission.createMany","Submission.createManyAndReturn","Submission.updateOne","Submission.updateMany","Submission.updateManyAndReturn","Submission.upsertOne","Submission.deleteOne","Submission.deleteMany","Submission.groupBy","Submission.aggregate","Resource.findUnique","Resource.findUniqueOrThrow","Resource.findFirst","Resource.findFirstOrThrow","Resource.findMany","Resource.createOne","Resource.createMany","Resource.createManyAndReturn","Resource.updateOne","Resource.updateMany","Resource.updateManyAndReturn","Resource.upsertOne","Resource.deleteOne","Resource.deleteMany","Resource.groupBy","Resource.aggregate","HelpPost.findUnique","HelpPost.findUniqueOrThrow","HelpPost.findFirst","HelpPost.findFirstOrThrow","HelpPost.findMany","HelpPost.createOne","HelpPost.createMany","HelpPost.createManyAndReturn","HelpPost.updateOne","HelpPost.updateMany","HelpPost.updateManyAndReturn","HelpPost.upsertOne","HelpPost.deleteOne","HelpPost.deleteMany","HelpPost.groupBy","HelpPost.aggregate","HelpResponse.findUnique","HelpResponse.findUniqueOrThrow","HelpResponse.findFirst","HelpResponse.findFirstOrThrow","HelpResponse.findMany","HelpResponse.createOne","HelpResponse.createMany","HelpResponse.createManyAndReturn","HelpResponse.updateOne","HelpResponse.updateMany","HelpResponse.updateManyAndReturn","HelpResponse.upsertOne","HelpResponse.deleteOne","HelpResponse.deleteMany","HelpResponse.groupBy","HelpResponse.aggregate","BloodPost.findUnique","BloodPost.findUniqueOrThrow","BloodPost.findFirst","BloodPost.findFirstOrThrow","BloodPost.findMany","BloodPost.createOne","BloodPost.createMany","BloodPost.createManyAndReturn","BloodPost.updateOne","BloodPost.updateMany","BloodPost.updateManyAndReturn","BloodPost.upsertOne","BloodPost.deleteOne","BloodPost.deleteMany","BloodPost.groupBy","BloodPost.aggregate","BloodResponse.findUnique","BloodResponse.findUniqueOrThrow","BloodResponse.findFirst","BloodResponse.findFirstOrThrow","BloodResponse.findMany","BloodResponse.createOne","BloodResponse.createMany","BloodResponse.createManyAndReturn","BloodResponse.updateOne","BloodResponse.updateMany","BloodResponse.updateManyAndReturn","BloodResponse.upsertOne","BloodResponse.deleteOne","BloodResponse.deleteMany","BloodResponse.groupBy","BloodResponse.aggregate","CourseReview.findUnique","CourseReview.findUniqueOrThrow","CourseReview.findFirst","CourseReview.findFirstOrThrow","CourseReview.findMany","CourseReview.createOne","CourseReview.createMany","CourseReview.createManyAndReturn","CourseReview.updateOne","CourseReview.updateMany","CourseReview.updateManyAndReturn","CourseReview.upsertOne","CourseReview.deleteOne","CourseReview.deleteMany","CourseReview.groupBy","CourseReview.aggregate","BusSchedule.findUnique","BusSchedule.findUniqueOrThrow","BusSchedule.findFirst","BusSchedule.findFirstOrThrow","BusSchedule.findMany","BusSchedule.createOne","BusSchedule.createMany","BusSchedule.createManyAndReturn","BusSchedule.updateOne","BusSchedule.updateMany","BusSchedule.updateManyAndReturn","BusSchedule.upsertOne","BusSchedule.deleteOne","BusSchedule.deleteMany","BusSchedule.groupBy","BusSchedule.aggregate","calendar","events","AcademicCalendar.findUnique","AcademicCalendar.findUniqueOrThrow","AcademicCalendar.findFirst","AcademicCalendar.findFirstOrThrow","AcademicCalendar.findMany","AcademicCalendar.createOne","AcademicCalendar.createMany","AcademicCalendar.createManyAndReturn","AcademicCalendar.updateOne","AcademicCalendar.updateMany","AcademicCalendar.updateManyAndReturn","AcademicCalendar.upsertOne","AcademicCalendar.deleteOne","AcademicCalendar.deleteMany","AcademicCalendar.groupBy","AcademicCalendar.aggregate","CalendarEvent.findUnique","CalendarEvent.findUniqueOrThrow","CalendarEvent.findFirst","CalendarEvent.findFirstOrThrow","CalendarEvent.findMany","CalendarEvent.createOne","CalendarEvent.createMany","CalendarEvent.createManyAndReturn","CalendarEvent.updateOne","CalendarEvent.updateMany","CalendarEvent.updateManyAndReturn","CalendarEvent.upsertOne","CalendarEvent.deleteOne","CalendarEvent.deleteMany","CalendarEvent.groupBy","CalendarEvent.aggregate","Notice.findUnique","Notice.findUniqueOrThrow","Notice.findFirst","Notice.findFirstOrThrow","Notice.findMany","Notice.createOne","Notice.createMany","Notice.createManyAndReturn","Notice.updateOne","Notice.updateMany","Notice.updateManyAndReturn","Notice.upsertOne","Notice.deleteOne","Notice.deleteMany","Notice.groupBy","Notice.aggregate","CampusEvent.findUnique","CampusEvent.findUniqueOrThrow","CampusEvent.findFirst","CampusEvent.findFirstOrThrow","CampusEvent.findMany","CampusEvent.createOne","CampusEvent.createMany","CampusEvent.createManyAndReturn","CampusEvent.updateOne","CampusEvent.updateMany","CampusEvent.updateManyAndReturn","CampusEvent.upsertOne","CampusEvent.deleteOne","CampusEvent.deleteMany","CampusEvent.groupBy","CampusEvent.aggregate","Complaint.findUnique","Complaint.findUniqueOrThrow","Complaint.findFirst","Complaint.findFirstOrThrow","Complaint.findMany","Complaint.createOne","Complaint.createMany","Complaint.createManyAndReturn","Complaint.updateOne","Complaint.updateMany","Complaint.updateManyAndReturn","Complaint.upsertOne","Complaint.deleteOne","Complaint.deleteMany","Complaint.groupBy","Complaint.aggregate","Alumni.findUnique","Alumni.findUniqueOrThrow","Alumni.findFirst","Alumni.findFirstOrThrow","Alumni.findMany","Alumni.createOne","Alumni.createMany","Alumni.createManyAndReturn","Alumni.updateOne","Alumni.updateMany","Alumni.updateManyAndReturn","Alumni.upsertOne","Alumni.deleteOne","Alumni.deleteMany","Alumni.groupBy","Alumni.aggregate","FieldBooking.findUnique","FieldBooking.findUniqueOrThrow","FieldBooking.findFirst","FieldBooking.findFirstOrThrow","FieldBooking.findMany","FieldBooking.createOne","FieldBooking.createMany","FieldBooking.createManyAndReturn","FieldBooking.updateOne","FieldBooking.updateMany","FieldBooking.updateManyAndReturn","FieldBooking.upsertOne","FieldBooking.deleteOne","FieldBooking.deleteMany","FieldBooking.groupBy","FieldBooking.aggregate","FieldSetting.findUnique","FieldSetting.findUniqueOrThrow","FieldSetting.findFirst","FieldSetting.findFirstOrThrow","FieldSetting.findMany","FieldSetting.createOne","FieldSetting.createMany","FieldSetting.createManyAndReturn","FieldSetting.updateOne","FieldSetting.updateMany","FieldSetting.updateManyAndReturn","FieldSetting.upsertOne","FieldSetting.deleteOne","FieldSetting.deleteMany","FieldSetting.groupBy","FieldSetting.aggregate","AND","OR","NOT","id","isBookingOpen","closedNotice","updatedAt","equals","in","notIn","lt","lte","gt","gte","not","contains","startsWith","endsWith","userId","purpose","bookingDate","startTime","endTime","BookingStatus","status","createdAt","name","email","batch","graduationYear","department","degree","currentCompany","currentPosition","skills","linkedInUrl","personalWebsiteUrl","image","has","hasEvery","hasSome","title","description","category","ComplaintStatus","location","eventDate","referenceNo","body","issuerName","issuerDesignation","copyTo","issueDate","calendarId","EventCategory","startDate","endDate","weekNumber","isHoliday","isAllDay","remarks","semester","academicYear","CalendarStatus","isActive","isGlobal","targetFaculties","targetDepartments","publishedAt","createdBy","updatedBy","every","some","none","route","busNumber","departureTime","stops","hubId","studentId","rating","comment","isAnonymous","answers","string_contains","string_starts_with","string_ends_with","array_starts_with","array_ends_with","array_contains","postId","responderId","message","authorId","patientName","patientCondition","BloodGroup","bloodGroup","urgency","contactPhone","isFulfilled","content","isResolved","driveUrl","uploaderId","isStudentNote","assessmentId","submittedUrl","marks","gradedById","creatorId","AssessmentType","type","SubmissionType","submissionType","deadline","totalMarks","discussionId","announcementId","attachedLinkUrl","attachedLinkTitle","HubRole","role","courseCode","courseName","credit","termOffer","weeklyClassSchedule","termExams","joinCode","isArchived","semesterNumber","isReviewOpen","reviewQuestions","teacherId","designation","faculty","officeRoom","consultationHours","expertiseFields","academicQualifications","program","currentSemester","section","isCR","isTA","identifier","value","expiresAt","accountId","providerId","accessToken","refreshToken","idToken","accessTokenExpiresAt","refreshTokenExpiresAt","scope","password","token","ipAddress","userAgent","emailVerified","SystemRole","phoneNumber","hubId_studentId","assessmentId_studentId","userId_hubId","is","isNot","connectOrCreate","upsert","createMany","set","disconnect","delete","connect","updateMany","deleteMany","push","increment","decrement","multiply","divide"]'),
  graph: "_Q2DAtADIQQAALgHACAFAAC5BwAgBgAAugcAIAcAALsHACALAACDBwAgEAAAvAcAIBMAAIUHACAbAACCBwAgHAAAhAcAIB0AALwHACAhAAC9BwAgIgAApAcAICMAAL4HACAkAACgBwAgJQAAvwcAICYAAMAHACAnAACGBwAgKAAAhwcAICkAAKkHACAqAACtBwAghQQAALUHADCGBAAAHgAQhwQAALUHADCIBAEAAAABiwRAALAGACGeBEAAsAYAIZ8EAQCtBgAhoAQBAAAAAaoEAQCvBgAh5gQAALcH5gQj_wQAALYHqAUjpgUgAK4GACGoBQEArwYAIQEAAAABACAMAwAAigcAIIUEAADKBwAwhgQAAAMAEIcEAADKBwAwiAQBAK0GACGLBEAAsAYAIZcEAQCtBgAhngRAALAGACGZBUAAsAYAIaMFAQCtBgAhpAUBAK8GACGlBQEArwYAIQMDAACrCgAgpAUAAMsHACClBQAAywcAIAwDAACKBwAghQQAAMoHADCGBAAAAwAQhwQAAMoHADCIBAEAAAABiwRAALAGACGXBAEArQYAIZ4EQACwBgAhmQVAALAGACGjBQEAAAABpAUBAK8GACGlBQEArwYAIQMAAAADACABAAAEADACAAAFACARAwAAigcAIIUEAADJBwAwhgQAAAcAEIcEAADJBwAwiAQBAK0GACGLBEAAsAYAIZcEAQCtBgAhngRAALAGACGaBQEArQYAIZsFAQCtBgAhnAUBAK8GACGdBQEArwYAIZ4FAQCvBgAhnwVAANQGACGgBUAA1AYAIaEFAQCvBgAhogUBAK8GACEIAwAAqwoAIJwFAADLBwAgnQUAAMsHACCeBQAAywcAIJ8FAADLBwAgoAUAAMsHACChBQAAywcAIKIFAADLBwAgEQMAAIoHACCFBAAAyQcAMIYEAAAHABCHBAAAyQcAMIgEAQAAAAGLBEAAsAYAIZcEAQCtBgAhngRAALAGACGaBQEArQYAIZsFAQCtBgAhnAUBAK8GACGdBQEArwYAIZ4FAQCvBgAhnwVAANQGACGgBUAA1AYAIaEFAQCvBgAhogUBAK8GACEDAAAABwAgAQAACAAwAgAACQAgEgMAAIoHACCFBAAAjAcAMIYEAAALABCHBAAAjAcAMIgEAQCtBgAhlwQBAK0GACGhBAEArQYAIaMEAQCtBgAhpwQAALcGACCoBAEArwYAIakEAQCvBgAh1AQBAK0GACGNBQEArQYAIZIFAQCtBgAhkwUCALsGACGUBQEArQYAIZUFIACuBgAhlgUgAK4GACEBAAAACwAgEAMAAIoHACCFBAAAiQcAMIYEAAANABCHBAAAiQcAMIgEAQCtBgAhlwQBAK0GACGjBAEArQYAIagEAQCvBgAhqQQBAK8GACGLBQEArQYAIYwFAQCtBgAhjQUBAK0GACGOBQEArwYAIY8FAQCvBgAhkAUAALcGACCRBQAAgQcAIAEAAAANACAKAwAAigcAIAoAAKgHACCFBAAAxwcAMIYEAAAPABCHBAAAxwcAMIgEAQCtBgAhlwQBAK0GACHFBCAArgYAIdMEAQCtBgAh_wQAAMgH_wQiAgMAAKsKACAKAAC9DAAgCwMAAIoHACAKAACoBwAghQQAAMcHADCGBAAADwAQhwQAAMcHADCIBAEAAAABlwQBAK0GACHFBCAArgYAIdMEAQCtBgAh_wQAAMgH_wQiqwUAAMYHACADAAAADwAgAQAAEAAwAgAAEQAgAwAAAA8AIAEAABAAMAIAABEAIA0JAACKBwAgCgAAxQcAIIUEAADEBwAwhgQAABQAEIcEAADEBwAwiAQBAK0GACGeBEAAsAYAIa4EAQCtBgAh0wQBAK8GACHVBAgA_wYAIewEAQCtBgAh7QQBAK0GACHuBCAArgYAIQMJAACrCgAgCgAAvQwAINMEAADLBwAgDQkAAIoHACAKAADFBwAghQQAAMQHADCGBAAAFAAQhwQAAMQHADCIBAEAAAABngRAALAGACGuBAEArQYAIdMEAQCvBgAh1QQIAP8GACHsBAEArQYAIe0EAQCtBgAh7gQgAK4GACEDAAAAFAAgAQAAFQAwAgAAFgAgGAgAAIIHACALAACDBwAgEgAAhAcAIBMAAIUHACAXAACGBwAgGgAAhwcAIIUEAAD-BgAwhgQAABgAEIcEAAD-BgAwiAQBAK0GACGeBEAAsAYAIaEEAQCtBgAhowQBAK0GACGABQEArQYAIYEFAQCtBgAhggUIAP8GACGDBQEArQYAIYQFAACABwAghQUAAIEHACCGBQEArQYAIYcFIACuBgAhiAUCALsGACGJBSAArgYAIYoFAACBBwAgAQAAABgAIBAKAACoBwAgDAAAtAcAIBAAALwHACCFBAAAwQcAMIYEAAAaABCHBAAAwQcAMIgEAQCtBgAhngRAALAGACGuBAEArQYAIa8EAQCvBgAh0wQBAK0GACHzBAEArwYAIfUEAADCB_UEIvcEAADDB_cEI_gEQACwBgAh-QQIAP8GACEGCgAAvQwAIAwAAKsKACAQAACxDAAgrwQAAMsHACDzBAAAywcAIPcEAADLBwAgEAoAAKgHACAMAAC0BwAgEAAAvAcAIIUEAADBBwAwhgQAABoAEIcEAADBBwAwiAQBAAAAAZ4EQACwBgAhrgQBAK0GACGvBAEArwYAIdMEAQCtBgAh8wQBAK8GACH1BAAAwgf1BCL3BAAAwwf3BCP4BEAAsAYAIfkECAD_BgAhAwAAABoAIAEAABsAMAIAABwAICEEAAC4BwAgBQAAuQcAIAYAALoHACAHAAC7BwAgCwAAgwcAIBAAALwHACATAACFBwAgGwAAggcAIBwAAIQHACAdAAC8BwAgIQAAvQcAICIAAKQHACAjAAC-BwAgJAAAoAcAICUAAL8HACAmAADABwAgJwAAhgcAICgAAIcHACApAACpBwAgKgAArQcAIIUEAAC1BwAwhgQAAB4AEIcEAAC1BwAwiAQBAK0GACGLBEAAsAYAIZ4EQACwBgAhnwQBAK0GACGgBAEArQYAIaoEAQCvBgAh5gQAALcH5gQj_wQAALYHqAUjpgUgAK4GACGoBQEArwYAIQEAAAAeACANDQAAswcAIA4AAIoHACAPAAC0BwAghQQAALEHADCGBAAAIAAQhwQAALEHADCIBAEArQYAIZ4EQACwBgAh1AQBAK0GACHvBAEArQYAIfAEAQCvBgAh8QQIALIHACHyBAEArwYAIQYNAAC_DAAgDgAAqwoAIA8AAKsKACDwBAAAywcAIPEEAADLBwAg8gQAAMsHACAODQAAswcAIA4AAIoHACAPAAC0BwAghQQAALEHADCGBAAAIAAQhwQAALEHADCIBAEAAAABngRAALAGACHUBAEArQYAIe8EAQCtBgAh8AQBAK8GACHxBAgAsgcAIfIEAQCvBgAhqgUAALAHACADAAAAIAAgAQAAIQAwAgAAIgAgAQAAAB4AIAEAAAAgACANCgAAqAcAIA4AAIoHACCFBAAArwcAMIYEAAAmABCHBAAArwcAMIgEAQCtBgAhngRAALAGACHTBAEArQYAIdQEAQCtBgAh1QQCALsGACHWBAEArwYAIdcEIACuBgAh2AQAAIEHACAECgAAvQwAIA4AAKsKACDWBAAAywcAINgEAADLBwAgDgoAAKgHACAOAACKBwAghQQAAK8HADCGBAAAJgAQhwQAAK8HADCIBAEAAAABngRAALAGACHTBAEArQYAIdQEAQCtBgAh1QQCALsGACHWBAEArwYAIdcEIACuBgAh2AQAAIEHACCpBQAArgcAIAMAAAAmACABAAAnADACAAAoACANCgAAqAcAIAwAAIoHACAWAACtBwAghQQAAKwHADCGBAAAKgAQhwQAAKwHADCIBAEArQYAIZ4EQACwBgAh0wQBAK0GACHqBAEArQYAIfMEAQCtBgAh_AQBAK8GACH9BAEArwYAIQUKAAC9DAAgDAAAqwoAIBYAALkMACD8BAAAywcAIP0EAADLBwAgDQoAAKgHACAMAACKBwAgFgAArQcAIIUEAACsBwAwhgQAACoAEIcEAACsBwAwiAQBAAAAAZ4EQACwBgAh0wQBAK0GACHqBAEArQYAIfMEAQCtBgAh_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ABbACABAABcADACAABdACANAwAAigcAIIUEAACYBwAwhgQAAF8AEIcEAACYBwAwiAQBAK0GACGLBEAAsAYAIZcEAQCtBgAhmAQBAK0GACGZBEAAsAYAIZoEQACwBgAhmwRAALAGACGdBAAAmQedBCKeBEAAsAYAIQEDAACrCgAgDQMAAIoHACCFBAAAmAcAMIYEAABfABCHBAAAmAcAMIgEAQAAAAGLBEAAsAYAIZcEAQCtBgAhmAQBAK0GACGZBEAAsAYAIZoEQACwBgAhmwRAALAGACGdBAAAmQedBCKeBEAAsAYAIQMAAABfACABAABgADACAABhACADAAAAKgAgAQAAKwAwAgAALAAgAwAAADMAIAEAADQAMAIAADUAIAMAAAA3ACABAAA4ADACAAA5ACADAAAALgAgAQAALwAwAgAAMAAgAQAAAAMAIAEAAAAHACABAAAADwAgAQAAABQAIAEAAAAaACABAAAAIAAgAQAAACAAIAEAAABGACABAAAASgAgAQAAAFAAIAEAAAAmACABAAAAVAAgAQAAAFsAIAEAAABfACABAAAAKgAgAQAAADMAIAEAAAA3ACABAAAALgAgAQAAAAEAIBgEAACtDAAgBQAArgwAIAYAAK8MACAHAACwDAAgCwAAnwoAIBAAALEMACATAAChCgAgGwAAngoAIBwAAKAKACAdAACxDAAgIQAAsgwAICIAALMMACAjAAC0DAAgJAAAtQwAICUAALYMACAmAAC3DAAgJwAAogoAICgAAKMKACApAAC4DAAgKgAAuQwAIKoEAADLBwAg5gQAAMsHACD_BAAAywcAIKgFAADLBwAgAwAAAB4AIAEAAHoAMAIAAAEAIAMAAAAeACABAAB6ADACAAABACADAAAAHgAgAQAAegAwAgAAAQAgHgQAAJkMACAFAACaDAAgBgAAmwwAIAcAAJwMACALAACeDAAgEAAAoAwAIBMAAKUMACAbAACdDAAgHAAAnwwAIB0AAKEMACAhAACiDAAgIgAAowwAICMAAKQMACAkAACmDAAgJQAApwwAICYAAKgMACAnAACpDAAgKAAAqgwAICkAAKsMACAqAACsDAAgiAQBAAAAAYsEQAAAAAGeBEAAAAABnwQBAAAAAaAEAQAAAAGqBAEAAAAB5gQAAADmBAP_BAAAAKgFA6YFIAAAAAGoBQEAAAABATAAAH4AIAqIBAEAAAABiwRAAAAAAZ4EQAAAAAGfBAEAAAABoAQBAAAAAaoEAQAAAAHmBAAAAOYEA_8EAAAAqAUDpgUgAAAAAagFAQAAAAEBMAAAgAEAMAEwAACAAQAwHgQAAMcKACAFAADICgAgBgAAyQoAIAcAAMoKACALAADMCgAgEAAAzgoAIBMAANMKACAbAADLCgAgHAAAzQoAIB0AAM8KACAhAADQCgAgIgAA0QoAICMAANIKACAkAADUCgAgJQAA1QoAICYAANYKACAnAADXCgAgKAAA2AoAICkAANkKACAqAADaCgAgiAQBAM8HACGLBEAA0gcAIZ4EQADSBwAhnwQBAM8HACGgBAEAzwcAIaoEAQDRBwAh5gQAAMYK5gQj_wQAAMUKqAUjpgUgANAHACGoBQEA0QcAIQIAAAABACAwAACDAQAgCogEAQDPBwAhiwRAANIHACGeBEAA0gcAIZ8EAQDPBwAhoAQBAM8HACGqBAEA0QcAIeYEAADGCuYEI_8EAADFCqgFI6YFIADQBwAhqAUBANEHACECAAAAHgAgMAAAhQEAIAIAAAAeACAwAACFAQAgAwAAAAEAIDcAAH4AIDgAAIMBACABAAAAAQAgAQAAAB4AIAcRAADCCgAgPQAAxAoAID4AAMMKACCqBAAAywcAIOYEAADLBwAg_wQAAMsHACCoBQAAywcAIA2FBAAAkQcAMIYEAACMAQAQhwQAAJEHADCIBAEAngYAIYsEQAChBgAhngRAAKEGACGfBAEAngYAIaAEAQCeBgAhqgQBAKAGACHmBAAAkwfmBCP_BAAAkgeoBSOmBSAAnwYAIagFAQCgBgAhAwAAAB4AIAEAAIsBADA8AACMAQAgAwAAAB4AIAEAAHoAMAIAAAEAIAEAAAAFACABAAAABQAgAwAAAAMAIAEAAAQAMAIAAAUAIAMAAAADACABAAAEADACAAAFACADAAAAAwAgAQAABAAwAgAABQAgCQMAAMEKACCIBAEAAAABiwRAAAAAAZcEAQAAAAGeBEAAAAABmQVAAAAAAaMFAQAAAAGkBQEAAAABpQUBAAAAAQEwAACUAQAgCIgEAQAAAAGLBEAAAAABlwQBAAAAAZ4EQAAAAAGZBUAAAAABowUBAAAAAaQFAQAAAAGlBQEAAAABATAAAJYBADABMAAAlgEAMAkDAADACgAgiAQBAM8HACGLBEAA0gcAIZcEAQDPBwAhngRAANIHACGZBUAA0gcAIaMFAQDPBwAhpAUBANEHACGlBQEA0QcAIQIAAAAFACAwAACZAQAgCIgEAQDPBwAhiwRAANIHACGXBAEAzwcAIZ4EQADSBwAhmQVAANIHACGjBQEAzwcAIaQFAQDRBwAhpQUBANEHACECAAAAAwAgMAAAmwEAIAIAAAADACAwAACbAQAgAwAAAAUAIDcAAJQBACA4AACZAQAgAQAAAAUAIAEAAAADACAFEQAAvQoAID0AAL8KACA-AAC-CgAgpAUAAMsHACClBQAAywcAIAuFBAAAkAcAMIYEAACiAQAQhwQAAJAHADCIBAEAngYAIYsEQAChBgAhlwQBAJ4GACGeBEAAoQYAIZkFQAChBgAhowUBAJ4GACGkBQEAoAYAIaUFAQCgBgAhAwAAAAMAIAEAAKEBADA8AACiAQAgAwAAAAMAIAEAAAQAMAIAAAUAIAEAAAAJACABAAAACQAgAwAAAAcAIAEAAAgAMAIAAAkAIAMAAAAHACABAAAIADACAAAJACADAAAABwAgAQAACAAwAgAACQAgDgMAALwKACCIBAEAAAABiwRAAAAAAZcEAQAAAAGeBEAAAAABmgUBAAAAAZsFAQAAAAGcBQEAAAABnQUBAAAAAZ4FAQAAAAGfBUAAAAABoAVAAAAAAaEFAQAAAAGiBQEAAAABATAAAKoBACANiAQBAAAAAYsEQAAAAAGXBAEAAAABngRAAAAAAZoFAQAAAAGbBQEAAAABnAUBAAAAAZ0FAQAAAAGeBQEAAAABnwVAAAAAAaAFQAAAAAGhBQEAAAABogUBAAAAAQEwAACsAQAwATAAAKwBADAOAwAAuwoAIIgEAQDPBwAhiwRAANIHACGXBAEAzwcAIZ4EQADSBwAhmgUBAM8HACGbBQEAzwcAIZwFAQDRBwAhnQUBANEHACGeBQEA0QcAIZ8FQAD1BwAhoAVAAPUHACGhBQEA0QcAIaIFAQDRBwAhAgAAAAkAIDAAAK8BACANiAQBAM8HACGLBEAA0gcAIZcEAQDPBwAhngRAANIHACGaBQEAzwcAIZsFAQDPBwAhnAUBANEHACGdBQEA0QcAIZ4FAQDRBwAhnwVAAPUHACGgBUAA9QcAIaEFAQDRBwAhogUBANEHACECAAAABwAgMAAAsQEAIAIAAAAHACAwAACxAQAgAwAAAAkAIDcAAKoBACA4AACvAQAgAQAAAAkAIAEAAAAHACAKEQAAuAoAID0AALoKACA-AAC5CgAgnAUAAMsHACCdBQAAywcAIJ4FAADLBwAgnwUAAMsHACCgBQAAywcAIKEFAADLBwAgogUAAMsHACAQhQQAAI8HADCGBAAAuAEAEIcEAACPBwAwiAQBAJ4GACGLBEAAoQYAIZcEAQCeBgAhngRAAKEGACGaBQEAngYAIZsFAQCeBgAhnAUBAKAGACGdBQEAoAYAIZ4FAQCgBgAhnwVAAMYGACGgBUAAxgYAIaEFAQCgBgAhogUBAKAGACEDAAAABwAgAQAAtwEAMDwAALgBACADAAAABwAgAQAACAAwAgAACQAgCYUEAACOBwAwhgQAAL4BABCHBAAAjgcAMIgEAQAAAAGLBEAAsAYAIZ4EQACwBgAhlwUBAK0GACGYBQEArQYAIZkFQACwBgAhAQAAALsBACABAAAAuwEAIAmFBAAAjgcAMIYEAAC-AQAQhwQAAI4HADCIBAEArQYAIYsEQACwBgAhngRAALAGACGXBQEArQYAIZgFAQCtBgAhmQVAALAGACEAAwAAAL4BACABAAC_AQAwAgAAuwEAIAMAAAC-AQAgAQAAvwEAMAIAALsBACADAAAAvgEAIAEAAL8BADACAAC7AQAgBogEAQAAAAGLBEAAAAABngRAAAAAAZcFAQAAAAGYBQEAAAABmQVAAAAAAQEwAADDAQAgBogEAQAAAAGLBEAAAAABngRAAAAAAZcFAQAAAAGYBQEAAAABmQVAAAAAAQEwAADFAQAwATAAAMUBADAGiAQBAM8HACGLBEAA0gcAIZ4EQADSBwAhlwUBAM8HACGYBQEAzwcAIZkFQADSBwAhAgAAALsBACAwAADIAQAgBogEAQDPBwAhiwRAANIHACGeBEAA0gcAIZcFAQDPBwAhmAUBAM8HACGZBUAA0gcAIQIAAAC-AQAgMAAAygEAIAIAAAC-AQAgMAAAygEAIAMAAAC7AQAgNwAAwwEAIDgAAMgBACABAAAAuwEAIAEAAAC-AQAgAxEAALUKACA9AAC3CgAgPgAAtgoAIAmFBAAAjQcAMIYEAADRAQAQhwQAAI0HADCIBAEAngYAIYsEQAChBgAhngRAAKEGACGXBQEAngYAIZgFAQCeBgAhmQVAAKEGACEDAAAAvgEAIAEAANABADA8AADRAQAgAwAAAL4BACABAAC_AQAwAgAAuwEAIBIDAACKBwAghQQAAIwHADCGBAAACwAQhwQAAIwHADCIBAEAAAABlwQBAAAAAaEEAQCtBgAhowQBAK0GACGnBAAAtwYAIKgEAQCvBgAhqQQBAK8GACHUBAEAAAABjQUBAK0GACGSBQEArQYAIZMFAgC7BgAhlAUBAK0GACGVBSAArgYAIZYFIACuBgAhAQAAANQBACABAAAA1AEAIAMDAACrCgAgqAQAAMsHACCpBAAAywcAIAMAAAALACABAADXAQAwAgAA1AEAIAMAAAALACABAADXAQAwAgAA1AEAIAMAAAALACABAADXAQAwAgAA1AEAIA8DAAC0CgAgiAQBAAAAAZcEAQAAAAGhBAEAAAABowQBAAAAAacEAACzCgAgqAQBAAAAAakEAQAAAAHUBAEAAAABjQUBAAAAAZIFAQAAAAGTBQIAAAABlAUBAAAAAZUFIAAAAAGWBSAAAAABATAAANsBACAOiAQBAAAAAZcEAQAAAAGhBAEAAAABowQBAAAAAacEAACzCgAgqAQBAAAAAakEAQAAAAHUBAEAAAABjQUBAAAAAZIFAQAAAAGTBQIAAAABlAUBAAAAAZUFIAAAAAGWBSAAAAABATAAAN0BADABMAAA3QEAMA8DAACyCgAgiAQBAM8HACGXBAEAzwcAIaEEAQDPBwAhowQBAM8HACGnBAAAsQoAIKgEAQDRBwAhqQQBANEHACHUBAEAzwcAIY0FAQDPBwAhkgUBAM8HACGTBQIA3gcAIZQFAQDPBwAhlQUgANAHACGWBSAA0AcAIQIAAADUAQAgMAAA4AEAIA6IBAEAzwcAIZcEAQDPBwAhoQQBAM8HACGjBAEAzwcAIacEAACxCgAgqAQBANEHACGpBAEA0QcAIdQEAQDPBwAhjQUBAM8HACGSBQEAzwcAIZMFAgDeBwAhlAUBAM8HACGVBSAA0AcAIZYFIADQBwAhAgAAAAsAIDAAAOIBACACAAAACwAgMAAA4gEAIAMAAADUAQAgNwAA2wEAIDgAAOABACABAAAA1AEAIAEAAAALACAHEQAArAoAID0AAK8KACA-AACuCgAgfwAArQoAIIABAACwCgAgqAQAAMsHACCpBAAAywcAIBGFBAAAiwcAMIYEAADpAQAQhwQAAIsHADCIBAEAngYAIZcEAQCeBgAhoQQBAJ4GACGjBAEAngYAIacEAAC3BgAgqAQBAKAGACGpBAEAoAYAIdQEAQCeBgAhjQUBAJ4GACGSBQEAngYAIZMFAgC2BgAhlAUBAJ4GACGVBSAAnwYAIZYFIACfBgAhAwAAAAsAIAEAAOgBADA8AADpAQAgAwAAAAsAIAEAANcBADACAADUAQAgEAMAAIoHACCFBAAAiQcAMIYEAAANABCHBAAAiQcAMIgEAQAAAAGXBAEAAAABowQBAK0GACGoBAEArwYAIakEAQCvBgAhiwUBAAAAAYwFAQCtBgAhjQUBAK0GACGOBQEArwYAIY8FAQCvBgAhkAUAALcGACCRBQAAgQcAIAEAAADsAQAgAQAAAOwBACAGAwAAqwoAIKgEAADLBwAgqQQAAMsHACCOBQAAywcAII8FAADLBwAgkQUAAMsHACADAAAADQAgAQAA7wEAMAIAAOwBACADAAAADQAgAQAA7wEAMAIAAOwBACADAAAADQAgAQAA7wEAMAIAAOwBACANAwAAqgoAIIgEAQAAAAGXBAEAAAABowQBAAAAAagEAQAAAAGpBAEAAAABiwUBAAAAAYwFAQAAAAGNBQEAAAABjgUBAAAAAY8FAQAAAAGQBQAAqQoAIJEFgAAAAAEBMAAA8wEAIAyIBAEAAAABlwQBAAAAAaMEAQAAAAGoBAEAAAABqQQBAAAAAYsFAQAAAAGMBQEAAAABjQUBAAAAAY4FAQAAAAGPBQEAAAABkAUAAKkKACCRBYAAAAABATAAAPUBADABMAAA9QEAMA0DAACoCgAgiAQBAM8HACGXBAEAzwcAIaMEAQDPBwAhqAQBANEHACGpBAEA0QcAIYsFAQDPBwAhjAUBAM8HACGNBQEAzwcAIY4FAQDRBwAhjwUBANEHACGQBQAApwoAIJEFgAAAAAECAAAA7AEAIDAAAPgBACAMiAQBAM8HACGXBAEAzwcAIaMEAQDPBwAhqAQBANEHACGpBAEA0QcAIYsFAQDPBwAhjAUBAM8HACGNBQEAzwcAIY4FAQDRBwAhjwUBANEHACGQBQAApwoAIJEFgAAAAAECAAAADQAgMAAA-gEAIAIAAAANACAwAAD6AQAgAwAAAOwBACA3AADzAQAgOAAA-AEAIAEAAADsAQAgAQAAAA0AIAgRAACkCgAgPQAApgoAID4AAKUKACCoBAAAywcAIKkEAADLBwAgjgUAAMsHACCPBQAAywcAIJEFAADLBwAgD4UEAACIBwAwhgQAAIECABCHBAAAiAcAMIgEAQCeBgAhlwQBAJ4GACGjBAEAngYAIagEAQCgBgAhqQQBAKAGACGLBQEAngYAIYwFAQCeBgAhjQUBAJ4GACGOBQEAoAYAIY8FAQCgBgAhkAUAALcGACCRBQAA3QYAIAMAAAANACABAACAAgAwPAAAgQIAIAMAAAANACABAADvAQAwAgAA7AEAIBgIAACCBwAgCwAAgwcAIBIAAIQHACATAACFBwAgFwAAhgcAIBoAAIcHACCFBAAA_gYAMIYEAAAYABCHBAAA_gYAMIgEAQAAAAGeBEAAsAYAIaEEAQCtBgAhowQBAK0GACGABQEArQYAIYEFAQCtBgAhggUIAP8GACGDBQEArQYAIYQFAACABwAghQUAAIEHACCGBQEAAAABhwUgAK4GACGIBQIAuwYAIYkFIACuBgAhigUAAIEHACABAAAAhAIAIAEAAACEAgAgCAgAAJ4KACALAACfCgAgEgAAoAoAIBMAAKEKACAXAACiCgAgGgAAowoAIIUFAADLBwAgigUAAMsHACADAAAAGAAgAQAAhwIAMAIAAIQCACADAAAAGAAgAQAAhwIAMAIAAIQCACADAAAAGAAgAQAAhwIAMAIAAIQCACAVCAAAmAoAIAsAAJkKACASAACaCgAgEwAAmwoAIBcAAJwKACAaAACdCgAgiAQBAAAAAZ4EQAAAAAGhBAEAAAABowQBAAAAAYAFAQAAAAGBBQEAAAABggUIAAAAAYMFAQAAAAGEBYAAAAABhQWAAAAAAYYFAQAAAAGHBSAAAAABiAUCAAAAAYkFIAAAAAGKBYAAAAABATAAAIsCACAPiAQBAAAAAZ4EQAAAAAGhBAEAAAABowQBAAAAAYAFAQAAAAGBBQEAAAABggUIAAAAAYMFAQAAAAGEBYAAAAABhQWAAAAAAYYFAQAAAAGHBSAAAAABiAUCAAAAAYkFIAAAAAGKBYAAAAABATAAAI0CADABMAAAjQIAMBUIAADKCQAgCwAAywkAIBIAAMwJACATAADNCQAgFwAAzgkAIBoAAM8JACCIBAEAzwcAIZ4EQADSBwAhoQQBAM8HACGjBAEAzwcAIYAFAQDPBwAhgQUBAM8HACGCBQgA2wgAIYMFAQDPBwAhhAWAAAAAAYUFgAAAAAGGBQEAzwcAIYcFIADQBwAhiAUCAN4HACGJBSAA0AcAIYoFgAAAAAECAAAAhAIAIDAAAJACACAPiAQBAM8HACGeBEAA0gcAIaEEAQDPBwAhowQBAM8HACGABQEAzwcAIYEFAQDPBwAhggUIANsIACGDBQEAzwcAIYQFgAAAAAGFBYAAAAABhgUBAM8HACGHBSAA0AcAIYgFAgDeBwAhiQUgANAHACGKBYAAAAABAgAAABgAIDAAAJICACACAAAAGAAgMAAAkgIAIAMAAACEAgAgNwAAiwIAIDgAAJACACABAAAAhAIAIAEAAAAYACAHEQAAxQkAID0AAMgJACA-AADHCQAgfwAAxgkAIIABAADJCQAghQUAAMsHACCKBQAAywcAIBKFBAAA-wYAMIYEAACZAgAQhwQAAPsGADCIBAEAngYAIZ4EQAChBgAhoQQBAJ4GACGjBAEAngYAIYAFAQCeBgAhgQUBAJ4GACGCBQgA5wYAIYMFAQCeBgAhhAUAAPwGACCFBQAA3QYAIIYFAQCeBgAhhwUgAJ8GACGIBQIAtgYAIYkFIACfBgAhigUAAN0GACADAAAAGAAgAQAAmAIAMDwAAJkCACADAAAAGAAgAQAAhwIAMAIAAIQCACABAAAAEQAgAQAAABEAIAMAAAAPACABAAAQADACAAARACADAAAADwAgAQAAEAAwAgAAEQAgAwAAAA8AIAEAABAAMAIAABEAIAcDAADDCQAgCgAAxAkAIIgEAQAAAAGXBAEAAAABxQQgAAAAAdMEAQAAAAH_BAAAAP8EAgEwAAChAgAgBYgEAQAAAAGXBAEAAAABxQQgAAAAAdMEAQAAAAH_BAAAAP8EAgEwAACjAgAwATAAAKMCADAHAwAAwQkAIAoAAMIJACCIBAEAzwcAIZcEAQDPBwAhxQQgANAHACHTBAEAzwcAIf8EAADACf8EIgIAAAARACAwAACmAgAgBYgEAQDPBwAhlwQBAM8HACHFBCAA0AcAIdMEAQDPBwAh_wQAAMAJ_wQiAgAAAA8AIDAAAKgCACACAAAADwAgMAAAqAIAIAMAAAARACA3AAChAgAgOAAApgIAIAEAAAARACABAAAADwAgAxEAAL0JACA9AAC_CQAgPgAAvgkAIAiFBAAA9wYAMIYEAACvAgAQhwQAAPcGADCIBAEAngYAIZcEAQCeBgAhxQQgAJ8GACHTBAEAngYAIf8EAAD4Bv8EIgMAAAAPACABAACuAgAwPAAArwIAIAMAAAAPACABAAAQADACAAARACABAAAALAAgAQAAACwAIAMAAAAqACABAAArADACAAAsACADAAAAKgAgAQAAKwAwAgAALAAgAwAAACoAIAEAACsAMAIAACwAIAoKAAC6CQAgDAAAuwkAIBYAALwJACCIBAEAAAABngRAAAAAAdMEAQAAAAHqBAEAAAAB8wQBAAAAAfwEAQAAAAH9BAEAAAABATAAALcCACAHiAQBAAAAAZ4EQAAAAAHTBAEAAAAB6gQBAAAAAfMEAQAAAAH8BAEAAAAB_QQBAAAAAQEwAAC5AgAwATAAALkCADAKCgAAqwkAIAwAAKwJACAWAACtCQAgiAQBAM8HACGeBEAA0gcAIdMEAQDPBwAh6gQBAM8HACHzBAEAzwcAIfwEAQDRBwAh_QQBANEHACECAAAALAAgMAAAvAIAIAeIBAEAzwcAIZ4EQADSBwAh0wQBAM8HACHqBAEAzwcAIfMEAQDPBwAh_AQBANEHACH9BAEA0QcAIQIAAAAqACAwAAC-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_gEQAChBgAh-QQIAOcGACEDAAAAGgAgAQAAngMAMDwAAJ8DACADAAAAGgAgAQAAGwAwAgAAHAAgAQAAACIAIAEAAAAiACADAAAAIAAgAQAAIQAwAgAAIgAgAwAAACAAIAEAACEAMAIAACIAIAMAAAAgACABAAAhADACAAAiACAKDQAA6QgAIA4AAOoIACAPAADrCAAgiAQBAAAAAZ4EQAAAAAHUBAEAAAAB7wQBAAAAAfAEAQAAAAHxBAgAAAAB8gQBAAAAAQEwAACnAwAgB4gEAQAAAAGeBEAAAAAB1AQBAAAAAe8EAQAAAAHwBAEAAAAB8QQIAAAAAfIEAQAAAAEBMAAAqQMAMAEwAACpAwAwAQAAAB4AIAoNAADmCAAgDgAA5wgAIA8AAOgIACCIBAEAzwcAIZ4EQADSBwAh1AQBAM8HACHvBAEAzwcAIfAEAQDRBwAh8QQIAOUIACHyBAEA0QcAIQIAAAAiACAwAACtAwAgB4gEAQDPBwAhngRAANIHACHUBAEAzwcAIe8EAQDPBwAh8AQBANEHACHxBAgA5QgAIfIEAQDRBwAhAgAAACAAIDAAAK8DACACAAAAIAAgMAAArwMAIAEAAAAeACADAAAAIgAgNwAApwMAIDgAAK0DACABAAAAIgAgAQAAACAAIAgRAADgCAAgPQAA4wgAID4AAOIIACB_AADhCAAggAEAAOQIACDwBAAAywcAIPEEAADLBwAg8gQAAMsHACAKhQQAAOkGADCGBAAAtwMAEIcEAADpBgAwiAQBAJ4GACGeBEAAoQYAIdQEAQCeBgAh7wQBAJ4GACHwBAEAoAYAIfEECADqBgAh8gQBAKAGACEDAAAAIAAgAQAAtgMAMDwAALcDACADAAAAIAAgAQAAIQAwAgAAIgAgAQAAABYAIAEAAAAWACADAAAAFAAgAQAAFQAwAgAAFgAgAwAAABQAIAEAABUAMAIAABYAIAMAAAAUACABAAAVADACAAAWACAKCQAA3ggAIAoAAN8IACCIBAEAAAABngRAAAAAAa4EAQAAAAHTBAEAAAAB1QQIAAAAAewEAQAAAAHtBAEAAAAB7gQgAAAAAQEwAAC_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_BCAArgYAIcAEIACuBgAhwQQBAK8GACEDAAAA2wQAIAEAANwEADACAADdBAAgAQAAANsEACABAAAA2QQAIBKEAwAA1QYAIIUEAADSBgAwhgQAAOEEABCHBAAA0gYAMIgEAQCtBgAhiwRAALAGACGdBAAA0wbFBCKeBEAAsAYAIa4EAQCtBgAhwgQBAK0GACHDBAIAuwYAIcUEIACuBgAhxgQgAK4GACHHBAAAtwYAIMgEAAC3BgAgyQRAANQGACHKBAEArwYAIcsEAQCvBgAhBIQDAACRCAAgyQQAAMsHACDKBAAAywcAIMsEAADLBwAgAwAAAOEEACABAADiBAAwAgAA2QQAIAMAAADhBAAgAQAA4gQAMAIAANkEACADAAAA4QQAIAEAAOIEADACAADZBAAgD4QDAACQCAAgiAQBAAAAAYsEQAAAAAGdBAAAAMUEAp4EQAAAAAGuBAEAAAABwgQBAAAAAcMEAgAAAAHFBCAAAAABxgQgAAAAAccEAACOCAAgyAQAAI8IACDJBEAAAAABygQBAAAAAcsEAQAAAAEBMAAA5gQAIA6IBAEAAAABiwRAAAAAAZ0EAAAAxQQCngRAAAAAAa4EAQAAAAHCBAEAAAABwwQCAAAAAcUEIAAAAAHGBCAAAAABxwQAAI4IACDIBAAAjwgAIMkEQAAAAAHKBAEAAAABywQBAAAAAQEwAADoBAAwATAAAOgEADAPhAMAAIEIACCIBAEAzwcAIYsEQADSBwAhnQQAAP4HxQQingRAANIHACGuBAEAzwcAIcIEAQDPBwAhwwQCAN4HACHFBCAA0AcAIcYEIADQBwAhxwQAAP8HACDIBAAAgAgAIMkEQAD1BwAhygQBANEHACHLBAEA0QcAIQIAAADZBAAgMAAA6wQAIA6IBAEAzwcAIYsEQADSBwAhnQQAAP4HxQQingRAANIHACGuBAEAzwcAIcIEAQDPBwAhwwQCAN4HACHFBCAA0AcAIcYEIADQBwAhxwQAAP8HACDIBAAAgAgAIMkEQAD1BwAhygQBANEHACHLBAEA0QcAIQIAAADhBAAgMAAA7QQAIAIAAADhBAAgMAAA7QQAIAMAAADZBAAgNwAA5gQAIDgAAOsEACABAAAA2QQAIAEAAADhBAAgCBEAAPkHACA9AAD8BwAgPgAA-wcAIH8AAPoHACCAAQAA_QcAIMkEAADLBwAgygQAAMsHACDLBAAAywcAIBGFBAAAzgYAMIYEAAD0BAAQhwQAAM4GADCIBAEAngYAIYsEQAChBgAhnQQAAM8GxQQingRAAKEGACGuBAEAngYAIcIEAQCeBgAhwwQCALYGACHFBCAAnwYAIcYEIACfBgAhxwQAALcGACDIBAAAtwYAIMkEQADGBgAhygQBAKAGACHLBAEAoAYAIQMAAADhBAAgAQAA8wQAMDwAAPQEACADAAAA4QQAIAEAAOIEADACAADZBAAgAQAAAN0EACABAAAA3QQAIAMAAADbBAAgAQAA3AQAMAIAAN0EACADAAAA2wQAIAEAANwEADACAADdBAAgAwAAANsEACABAADcBAAwAgAA3QQAIA6DAwAA-AcAIIgEAQAAAAGLBEAAAAABngRAAAAAAa4EAQAAAAGvBAEAAAABsAQAAAC8BAK6BAEAAAABvARAAAAAAb0EQAAAAAG-BAIAAAABvwQgAAAAAcAEIAAAAAHBBAEAAAABATAAAPwEACANiAQBAAAAAYsEQAAAAAGeBEAAAAABrgQBAAAAAa8EAQAAAAGwBAAAALwEAroEAQAAAAG8BEAAAAABvQRAAAAAAb4EAgAAAAG_BCAAAAABwAQgAAAAAcEEAQAAAAEBMAAA_gQAMAEwAAD-BAAwDoMDAAD3BwAgiAQBAM8HACGLBEAA0gcAIZ4EQADSBwAhrgQBAM8HACGvBAEA0QcAIbAEAAD0B7wEIroEAQDPBwAhvARAANIHACG9BEAA9QcAIb4EAgD2BwAhvwQgANAHACHABCAA0AcAIcEEAQDRBwAhAgAAAN0EACAwAACBBQAgDYgEAQDPBwAhiwRAANIHACGeBEAA0gcAIa4EAQDPBwAhrwQBANEHACGwBAAA9Ae8BCK6BAEAzwcAIbwEQADSBwAhvQRAAPUHACG-BAIA9gcAIb8EIADQBwAhwAQgANAHACHBBAEA0QcAIQIAAADbBAAgMAAAgwUAIAIAAADbBAAgMAAAgwUAIAMAAADdBAAgNwAA_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_BgAgPgAAvwYAIIwEAAAAsgQCjQQAAACyBAiOBAAAALIECJMEAAC-BrIEIgcRAACjBgAgPQAAvwYAID4AAL8GACCMBAAAALIEAo0EAAAAsgQIjgQAAACyBAiTBAAAvgayBCIEjAQAAACyBAKNBAAAALIECI4EAAAAsgQIkwQAAL8GsgQiCoUEAADABgAwhgQAALwFABCHBAAAwAYAMIgEAQCeBgAhiwRAAKEGACGeBEAAoQYAIa4EAQCeBgAhrwQBAKAGACGyBAEAoAYAIbMEQAChBgAhCoUEAADBBgAwhgQAAKkFABCHBAAAwQYAMIgEAQCtBgAhiwRAALAGACGeBEAAsAYAIa4EAQCtBgAhrwQBAK8GACGyBAEArwYAIbMEQACwBgAhDYUEAADCBgAwhgQAAKMFABCHBAAAwgYAMIgEAQCeBgAhiwRAAKEGACGeBEAAoQYAIa4EAQCeBgAhtAQBAKAGACG1BAEAngYAIbYEAQCeBgAhtwQBAJ4GACG4BAAAtwYAILkEQAChBgAhDYUEAADDBgAwhgQAAJAFABCHBAAAwwYAMIgEAQCtBgAhiwRAALAGACGeBEAAsAYAIa4EAQCtBgAhtAQBAK8GACG1BAEArQYAIbYEAQCtBgAhtwQBAK0GACG4BAAAtwYAILkEQACwBgAhEIUEAADEBgAwhgQAAIoFABCHBAAAxAYAMIgEAQCeBgAhiwRAAKEGACGeBEAAoQYAIa4EAQCeBgAhrwQBAKAGACGwBAAAxQa8BCK6BAEAngYAIbwEQAChBgAhvQRAAMYGACG-BAIAxwYAIb8EIACfBgAhwAQgAJ8GACHBBAEAoAYAIQcRAACjBgAgPQAAzQYAID4AAM0GACCMBAAAALwEAo0EAAAAvAQIjgQAAAC8BAiTBAAAzAa8BCILEQAApgYAID0AAMsGACA-AADLBgAgjARAAAAAAY0EQAAAAAWOBEAAAAAFjwRAAAAAAZAEQAAAAAGRBEAAAAABkgRAAAAAAZMEQADKBgAhDREAAKYGACA9AACmBgAgPgAApgYAIH8AAMkGACCAAQAApgYAIIwEAgAAAAGNBAIAAAAFjgQCAAAABY8EAgAAAAGQBAIAAAABkQQCAAAAAZIEAgAAAAGTBAIAyAYAIQ0RAACmBgAgPQAApgYAID4AAKYGACB_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_AAC5BgAggAEAALkGACCMBAgAAAABjQQIAAAABI4ECAAAAASPBAgAAAABkAQIAAAAAZEECAAAAAGSBAgAAAABkwQIAOgGACENEQAAowYAID0AALkGACA-AAC5BgAgfwAAuQYAIIABAAC5BgAgjAQIAAAAAY0ECAAAAASOBAgAAAAEjwQIAAAAAZAECAAAAAGRBAgAAAABkgQIAAAAAZMECADoBgAhCoUEAADpBgAwhgQAALcDABCHBAAA6QYAMIgEAQCeBgAhngRAAKEGACHUBAEAngYAIe8EAQCeBgAh8AQBAKAGACHxBAgA6gYAIfIEAQCgBgAhDREAAKYGACA9AADJBgAgPgAAyQYAIH8AAMkGACCAAQAAyQYAIIwECAAAAAGNBAgAAAAFjgQIAAAABY8ECAAAAAGQBAgAAAABkQQIAAAAAZIECAAAAAGTBAgA6wYAIQ0RAACmBgAgPQAAyQYAID4AAMkGACB_AADJBgAggAEAAMkGACCMBAgAAAABjQQIAAAABY4ECAAAAAWPBAgAAAABkAQIAAAAAZEECAAAAAGSBAgAAAABkwQIAOsGACENhQQAAOwGADCGBAAAnwMAEIcEAADsBgAwiAQBAJ4GACGeBEAAoQYAIa4EAQCeBgAhrwQBAKAGACHTBAEAngYAIfMEAQCgBgAh9QQAAO0G9QQi9wQAAO4G9wQj-ARAAKEGACH5BAgA5wYAIQcRAACjBgAgPQAA8gYAID4AAPIGACCMBAAAAPUEAo0EAAAA9QQIjgQAAAD1BAiTBAAA8Qb1BCIHEQAApgYAID0AAPAGACA-AADwBgAgjAQAAAD3BAONBAAAAPcECY4EAAAA9wQJkwQAAO8G9wQjBxEAAKYGACA9AADwBgAgPgAA8AYAIIwEAAAA9wQDjQQAAAD3BAmOBAAAAPcECZMEAADvBvcEIwSMBAAAAPcEA40EAAAA9wQJjgQAAAD3BAmTBAAA8Ab3BCMHEQAAowYAID0AAPIGACA-AADyBgAgjAQAAAD1BAKNBAAAAPUECI4EAAAA9QQIkwQAAPEG9QQiBIwEAAAA9QQCjQQAAAD1BAiOBAAAAPUECJMEAADyBvUEIgiFBAAA8wYAMIYEAACHAwAQhwQAAPMGADCIBAEAngYAIZ4EQAChBgAh4gQBAJ4GACHqBAEAngYAIfoEAQCeBgAhCYUEAAD0BgAwhgQAAPECABCHBAAA9AYAMIgEAQCeBgAhngRAAKEGACGuBAEAngYAIdMEAQCeBgAh4gQBAJ4GACHqBAEAngYAIQiFBAAA9QYAMIYEAADbAgAQhwQAAPUGADCIBAEAngYAIZ4EQAChBgAh4gQBAJ4GACHqBAEAngYAIfsEAQCeBgAhCoUEAAD2BgAwhgQAAMUCABCHBAAA9gYAMIgEAQCeBgAhngRAAKEGACHTBAEAngYAIeoEAQCeBgAh8wQBAJ4GACH8BAEAoAYAIf0EAQCgBgAhCIUEAAD3BgAwhgQAAK8CABCHBAAA9wYAMIgEAQCeBgAhlwQBAJ4GACHFBCAAnwYAIdMEAQCeBgAh_wQAAPgG_wQiBxEAAKMGACA9AAD6BgAgPgAA-gYAIIwEAAAA_wQCjQQAAAD_BAiOBAAAAP8ECJMEAAD5Bv8EIgcRAACjBgAgPQAA-gYAID4AAPoGACCMBAAAAP8EAo0EAAAA_wQIjgQAAAD_BAiTBAAA-Qb_BCIEjAQAAAD_BAKNBAAAAP8ECI4EAAAA_wQIkwQAAPoG_wQiEoUEAAD7BgAwhgQAAJkCABCHBAAA-wYAMIgEAQCeBgAhngRAAKEGACGhBAEAngYAIaMEAQCeBgAhgAUBAJ4GACGBBQEAngYAIYIFCADnBgAhgwUBAJ4GACGEBQAA_AYAIIUFAADdBgAghgUBAJ4GACGHBSAAnwYAIYgFAgC2BgAhiQUgAJ8GACGKBQAA3QYAIA8RAACjBgAgPQAA_QYAID4AAP0GACCMBIAAAAABjwSAAAAAAZAEgAAAAAGRBIAAAAABkgSAAAAAAZMEgAAAAAHZBAEAAAAB2gQBAAAAAdsEAQAAAAHcBIAAAAAB3QSAAAAAAd4EgAAAAAEMjASAAAAAAY8EgAAAAAGQBIAAAAABkQSAAAAAAZIEgAAAAAGTBIAAAAAB2QQBAAAAAdoEAQAAAAHbBAEAAAAB3ASAAAAAAd0EgAAAAAHeBIAAAAABGAgAAIIHACALAACDBwAgEgAAhAcAIBMAAIUHACAXAACGBwAgGgAAhwcAIIUEAAD-BgAwhgQAABgAEIcEAAD-BgAwiAQBAK0GACGeBEAAsAYAIaEEAQCtBgAhowQBAK0GACGABQEArQYAIYEFAQCtBgAhggUIAP8GACGDBQEArQYAIYQFAACABwAghQUAAIEHACCGBQEArQYAIYcFIACuBgAhiAUCALsGACGJBSAArgYAIYoFAACBBwAgCIwECAAAAAGNBAgAAAAEjgQIAAAABI8ECAAAAAGQBAgAAAABkQQIAAAAAZIECAAAAAGTBAgAuQYAIQyMBIAAAAABjwSAAAAAAZAEgAAAAAGRBIAAAAABkgSAAAAAAZMEgAAAAAHZBAEAAAAB2gQBAAAAAdsEAQAAAAHcBIAAAAAB3QSAAAAAAd4EgAAAAAEMjASAAAAAAY8EgAAAAAGQBIAAAAABkQSAAAAAAZIEgAAAAAGTBIAAAAAB2QQBAAAAAdoEAQAAAAHbBAEAAAAB3ASAAAAAAd0EgAAAAAHeBIAAAAABA8wEAAAPACDNBAAADwAgzgQAAA8AIAPMBAAAFAAgzQQAABQAIM4EAAAUACADzAQAABoAIM0EAAAaACDOBAAAGgAgA8wEAAAmACDNBAAAJgAgzgQAACYAIAPMBAAAKgAgzQQAACoAIM4EAAAqACADzAQAADMAIM0EAAAzACDOBAAAMwAgD4UEAACIBwAwhgQAAIECABCHBAAAiAcAMIgEAQCeBgAhlwQBAJ4GACGjBAEAngYAIagEAQCgBgAhqQQBAKAGACGLBQEAngYAIYwFAQCeBgAhjQUBAJ4GACGOBQEAoAYAIY8FAQCgBgAhkAUAALcGACCRBQAA3QYAIBADAACKBwAghQQAAIkHADCGBAAADQAQhwQAAIkHADCIBAEArQYAIZcEAQCtBgAhowQBAK0GACGoBAEArwYAIakEAQCvBgAhiwUBAK0GACGMBQEArQYAIY0FAQCtBgAhjgUBAK8GACGPBQEArwYAIZAFAAC3BgAgkQUAAIEHACAjBAAAuAcAIAUAALkHACAGAAC6BwAgBwAAuwcAIAsAAIMHACAQAAC8BwAgEwAAhQcAIBsAAIIHACAcAACEBwAgHQAAvAcAICEAAL0HACAiAACkBwAgIwAAvgcAICQAAKAHACAlAAC_BwAgJgAAwAcAICcAAIYHACAoAACHBwAgKQAAqQcAICoAAK0HACCFBAAAtQcAMIYEAAAeABCHBAAAtQcAMIgEAQCtBgAhiwRAALAGACGeBEAAsAYAIZ8EAQCtBgAhoAQBAK0GACGqBAEArwYAIeYEAAC3B-YEI_8EAAC2B6gFI6YFIACuBgAhqAUBAK8GACGsBQAAHgAgrQUAAB4AIBGFBAAAiwcAMIYEAADpAQAQhwQAAIsHADCIBAEAngYAIZcEAQCeBgAhoQQBAJ4GACGjBAEAngYAIacEAAC3BgAgqAQBAKAGACGpBAEAoAYAIdQEAQCeBgAhjQUBAJ4GACGSBQEAngYAIZMFAgC2BgAhlAUBAJ4GACGVBSAAnwYAIZYFIACfBgAhEgMAAIoHACCFBAAAjAcAMIYEAAALABCHBAAAjAcAMIgEAQCtBgAhlwQBAK0GACGhBAEArQYAIaMEAQCtBgAhpwQAALcGACCoBAEArwYAIakEAQCvBgAh1AQBAK0GACGNBQEArQYAIZIFAQCtBgAhkwUCALsGACGUBQEArQYAIZUFIACuBgAhlgUgAK4GACEJhQQAAI0HADCGBAAA0QEAEIcEAACNBwAwiAQBAJ4GACGLBEAAoQYAIZ4EQAChBgAhlwUBAJ4GACGYBQEAngYAIZkFQAChBgAhCYUEAACOBwAwhgQAAL4BABCHBAAAjgcAMIgEAQCtBgAhiwRAALAGACGeBEAAsAYAIZcFAQCtBgAhmAUBAK0GACGZBUAAsAYAIRCFBAAAjwcAMIYEAAC4AQAQhwQAAI8HADCIBAEAngYAIYsEQAChBgAhlwQBAJ4GACGeBEAAoQYAIZoFAQCeBgAhmwUBAJ4GACGcBQEAoAYAIZ0FAQCgBgAhngUBAKAGACGfBUAAxgYAIaAFQADGBgAhoQUBAKAGACGiBQEAoAYAIQuFBAAAkAcAMIYEAACiAQAQhwQAAJAHADCIBAEAngYAIYsEQAChBgAhlwQBAJ4GACGeBEAAoQYAIZkFQAChBgAhowUBAJ4GACGkBQEAoAYAIaUFAQCgBgAhDYUEAACRBwAwhgQAAIwBABCHBAAAkQcAMIgEAQCeBgAhiwRAAKEGACGeBEAAoQYAIZ8EAQCeBgAhoAQBAJ4GACGqBAEAoAYAIeYEAACTB-YEI_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_wYAIYMFAQCtBgAhhAUAAIAHACCFBQAAgQcAIIYFAQCtBgAhhwUgAK4GACGIBQIAuwYAIYkFIACuBgAhigUAAIEHACCsBQAAGAAgrQUAABgAIAPMBAAANwAgzQQAADcAIM4EAAA3ACAKFAAAqwcAIBUAAIoHACCFBAAAqgcAMIYEAAAuABCHBAAAqgcAMIgEAQCtBgAhngRAALAGACHiBAEArQYAIeoEAQCtBgAh-wQBAK0GACEPCgAAqAcAIAwAAIoHACAWAACtBwAghQQAAKwHADCGBAAAKgAQhwQAAKwHADCIBAEArQYAIZ4EQACwBgAh0wQBAK0GACHqBAEArQYAIfMEAQCtBgAh_AQBAK8GACH9BAEArwYAIawFAAAqACCtBQAAKgAgDQoAAKgHACAMAACKBwAgFgAArQcAIIUEAACsBwAwhgQAACoAEIcEAACsBwAwiAQBAK0GACGeBEAAsAYAIdMEAQCtBgAh6gQBAK0GACHzBAEArQYAIfwEAQCvBgAh_QQBAK8GACEDzAQAAC4AIM0EAAAuACDOBAAALgAgAtMEAQAAAAHUBAEAAAABDQoAAKgHACAOAACKBwAghQQAAK8HADCGBAAAJgAQhwQAAK8HADCIBAEArQYAIZ4EQACwBgAh0wQBAK0GACHUBAEArQYAIdUEAgC7BgAh1gQBAK8GACHXBCAArgYAIdgEAACBBwAgAtQEAQAAAAHvBAEAAAABDQ0AALMHACAOAACKBwAgDwAAtAcAIIUEAACxBwAwhgQAACAAEIcEAACxBwAwiAQBAK0GACGeBEAAsAYAIdQEAQCtBgAh7wQBAK0GACHwBAEArwYAIfEECACyBwAh8gQBAK8GACEIjAQIAAAAAY0ECAAAAAWOBAgAAAAFjwQIAAAAAZAECAAAAAGRBAgAAAABkgQIAAAAAZMECADJBgAhEgoAAKgHACAMAAC0BwAgEAAAvAcAIIUEAADBBwAwhgQAABoAEIcEAADBBwAwiAQBAK0GACGeBEAAsAYAIa4EAQCtBgAhrwQBAK8GACHTBAEArQYAIfMEAQCvBgAh9QQAAMIH9QQi9wQAAMMH9wQj-ARAALAGACH5BAgA_wYAIawFAAAaACCtBQAAGgAgIwQAALgHACAFAAC5BwAgBgAAugcAIAcAALsHACALAACDBwAgEAAAvAcAIBMAAIUHACAbAACCBwAgHAAAhAcAIB0AALwHACAhAAC9BwAgIgAApAcAICMAAL4HACAkAACgBwAgJQAAvwcAICYAAMAHACAnAACGBwAgKAAAhwcAICkAAKkHACAqAACtBwAghQQAALUHADCGBAAAHgAQhwQAALUHADCIBAEArQYAIYsEQACwBgAhngRAALAGACGfBAEArQYAIaAEAQCtBgAhqgQBAK8GACHmBAAAtwfmBCP_BAAAtgeoBSOmBSAArgYAIagFAQCvBgAhrAUAAB4AIK0FAAAeACAhBAAAuAcAIAUAALkHACAGAAC6BwAgBwAAuwcAIAsAAIMHACAQAAC8BwAgEwAAhQcAIBsAAIIHACAcAACEBwAgHQAAvAcAICEAAL0HACAiAACkBwAgIwAAvgcAICQAAKAHACAlAAC_BwAgJgAAwAcAICcAAIYHACAoAACHBwAgKQAAqQcAICoAAK0HACCFBAAAtQcAMIYEAAAeABCHBAAAtQcAMIgEAQCtBgAhiwRAALAGACGeBEAAsAYAIZ8EAQCtBgAhoAQBAK0GACGqBAEArwYAIeYEAAC3B-YEI_8EAAC2B6gFI6YFIACuBgAhqAUBAK8GACEEjAQAAACoBQONBAAAAKgFCY4EAAAAqAUJkwQAAJcHqAUjBIwEAAAA5gQDjQQAAADmBAmOBAAAAOYECZMEAACVB-YEIwPMBAAAAwAgzQQAAAMAIM4EAAADACADzAQAAAcAIM0EAAAHACDOBAAABwAgFAMAAIoHACCFBAAAjAcAMIYEAAALABCHBAAAjAcAMIgEAQCtBgAhlwQBAK0GACGhBAEArQYAIaMEAQCtBgAhpwQAALcGACCoBAEArwYAIakEAQCvBgAh1AQBAK0GACGNBQEArQYAIZIFAQCtBgAhkwUCALsGACGUBQEArQYAIZUFIACuBgAhlgUgAK4GACGsBQAACwAgrQUAAAsAIBIDAACKBwAghQQAAIkHADCGBAAADQAQhwQAAIkHADCIBAEArQYAIZcEAQCtBgAhowQBAK0GACGoBAEArwYAIakEAQCvBgAhiwUBAK0GACGMBQEArQYAIY0FAQCtBgAhjgUBAK8GACGPBQEArwYAIZAFAAC3BgAgkQUAAIEHACCsBQAADQAgrQUAAA0AIAPMBAAAIAAgzQQAACAAIM4EAAAgACADzAQAAEYAIM0EAABGACDOBAAARgAgA8wEAABQACDNBAAAUAAgzgQAAFAAIAPMBAAAWwAgzQQAAFsAIM4EAABbACADzAQAAF8AIM0EAABfACDOBAAAXwAgEAoAAKgHACAMAAC0BwAgEAAAvAcAIIUEAADBBwAwhgQAABoAEIcEAADBBwAwiAQBAK0GACGeBEAAsAYAIa4EAQCtBgAhrwQBAK8GACHTBAEArQYAIfMEAQCvBgAh9QQAAMIH9QQi9wQAAMMH9wQj-ARAALAGACH5BAgA_wYAIQSMBAAAAPUEAo0EAAAA9QQIjgQAAAD1BAiTBAAA8gb1BCIEjAQAAAD3BAONBAAAAPcECY4EAAAA9wQJkwQAAPAG9wQjDQkAAIoHACAKAADFBwAghQQAAMQHADCGBAAAFAAQhwQAAMQHADCIBAEArQYAIZ4EQACwBgAhrgQBAK0GACHTBAEArwYAIdUECAD_BgAh7AQBAK0GACHtBAEArQYAIe4EIACuBgAhGggAAIIHACALAACDBwAgEgAAhAcAIBMAAIUHACAXAACGBwAgGgAAhwcAIIUEAAD-BgAwhgQAABgAEIcEAAD-BgAwiAQBAK0GACGeBEAAsAYAIaEEAQCtBgAhowQBAK0GACGABQEArQYAIYEFAQCtBgAhggUIAP8GACGDBQEArQYAIYQFAACABwAghQUAAIEHACCGBQEArQYAIYcFIACuBgAhiAUCALsGACGJBSAArgYAIYoFAACBBwAgrAUAABgAIK0FAAAYACAClwQBAAAAAdMEAQAAAAEKAwAAigcAIAoAAKgHACCFBAAAxwcAMIYEAAAPABCHBAAAxwcAMIgEAQCtBgAhlwQBAK0GACHFBCAArgYAIdMEAQCtBgAh_wQAAMgH_wQiBIwEAAAA_wQCjQQAAAD_BAiOBAAAAP8ECJMEAAD6Bv8EIhEDAACKBwAghQQAAMkHADCGBAAABwAQhwQAAMkHADCIBAEArQYAIYsEQACwBgAhlwQBAK0GACGeBEAAsAYAIZoFAQCtBgAhmwUBAK0GACGcBQEArwYAIZ0FAQCvBgAhngUBAK8GACGfBUAA1AYAIaAFQADUBgAhoQUBAK8GACGiBQEArwYAIQwDAACKBwAghQQAAMoHADCGBAAAAwAQhwQAAMoHADCIBAEArQYAIYsEQACwBgAhlwQBAK0GACGeBEAAsAYAIZkFQACwBgAhowUBAK0GACGkBQEArwYAIaUFAQCvBgAhAAAAAAGxBQEAAAABAbEFIAAAAAEBsQUBAAAAAQGxBUAAAAABAAAAAbEFAAAAnQQCBTcAAPkNACA4AAD8DQAgrgUAAPoNACCvBQAA-w0AILQFAAABACADNwAA-Q0AIK4FAAD6DQAgtAUAAAEAIAAAAAAABbEFAgAAAAG4BQIAAAABuQUCAAAAAboFAgAAAAG7BQIAAAABArEFAQAAAAS3BQEAAAAFAbEFAQAAAAQAAAABsQUAAACyBAIFNwAA9A0AIDgAAPcNACCuBQAA9Q0AIK8FAAD2DQAgtAUAAAEAIAM3AAD0DQAgrgUAAPUNACC0BQAAAQAgAAAAAAAAArEFAQAAAAS3BQEAAAAFAbEFAQAAAAQAAAAAAAGxBQAAALwEAgGxBUAAAAABBbEFAgAAAAG4BQIAAAABuQUCAAAAAboFAgAAAAG7BQIAAAABBTcAAO8NACA4AADyDQAgrgUAAPANACCvBQAA8Q0AILQFAADZBAAgAzcAAO8NACCuBQAA8A0AILQFAADZBAAgAAAAAAABsQUAAADFBAICsQUBAAAABLcFAQAAAAUCsQUBAAAABLcFAQAAAAULNwAAgggAMDgAAIcIADCuBQAAgwgAMK8FAACECAAwsAUAAIUIACCxBQAAhggAMLIFAACGCAAwswUAAIYIADC0BQAAhggAMLUFAACICAAwtgUAAIkIADAMiAQBAAAAAYsEQAAAAAGeBEAAAAABrgQBAAAAAa8EAQAAAAGwBAAAALwEArwEQAAAAAG9BEAAAAABvgQCAAAAAb8EIAAAAAHABCAAAAABwQQBAAAAAQIAAADdBAAgNwAAjQgAIAMAAADdBAAgNwAAjQgAIDgAAIwIACABMAAA7g0AMBGDAwAA2QYAIIUEAADWBgAwhgQAANsEABCHBAAA1gYAMIgEAQAAAAGLBEAAsAYAIZ4EQACwBgAhrgQBAK0GACGvBAEArwYAIbAEAADXBrwEIroEAQCtBgAhvARAALAGACG9BEAA1AYAIb4EAgDYBgAhvwQgAK4GACHABCAArgYAIcEEAQCvBgAhAgAAAN0EACAwAACMCAAgAgAAAIoIACAwAACLCAAgEIUEAACJCAAwhgQAAIoIABCHBAAAiQgAMIgEAQCtBgAhiwRAALAGACGeBEAAsAYAIa4EAQCtBgAhrwQBAK8GACGwBAAA1wa8BCK6BAEArQYAIbwEQACwBgAhvQRAANQGACG-BAIA2AYAIb8EIACuBgAhwAQgAK4GACHBBAEArwYAIRCFBAAAiQgAMIYEAACKCAAQhwQAAIkIADCIBAEArQYAIYsEQACwBgAhngRAALAGACGuBAEArQYAIa8EAQCvBgAhsAQAANcGvAQiugQBAK0GACG8BEAAsAYAIb0EQADUBgAhvgQCANgGACG_BCAArgYAIcAEIACuBgAhwQQBAK8GACEMiAQBAM8HACGLBEAA0gcAIZ4EQADSBwAhrgQBAM8HACGvBAEA0QcAIbAEAAD0B7wEIrwEQADSBwAhvQRAAPUHACG-BAIA9gcAIb8EIADQBwAhwAQgANAHACHBBAEA0QcAIQyIBAEAzwcAIYsEQADSBwAhngRAANIHACGuBAEAzwcAIa8EAQDRBwAhsAQAAPQHvAQivARAANIHACG9BEAA9QcAIb4EAgD2BwAhvwQgANAHACHABCAA0AcAIcEEAQDRBwAhDIgEAQAAAAGLBEAAAAABngRAAAAAAa4EAQAAAAGvBAEAAAABsAQAAAC8BAK8BEAAAAABvQRAAAAAAb4EAgAAAAG_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_DQAgrgUAALsNACCvBQAAvg0AILIFAAAYACCzBQAAGAAgtAUAAIQCACADNwAAvA0AIK4FAAC9DQAgtAUAAAEAIAM3AAC6DQAgrgUAALsNACC0BQAAhAIAIAAAAAAABbEFCAAAAAG4BQgAAAABuQUIAAAAAboFCAAAAAG7BQgAAAABBTcAAK8NACA4AAC4DQAgrgUAALANACCvBQAAtw0AILQFAAAcACAFNwAArQ0AIDgAALUNACCuBQAArg0AIK8FAAC0DQAgtAUAAAEAIAc3AACrDQAgOAAAsg0AIK4FAACsDQAgrwUAALENACCyBQAAHgAgswUAAB4AILQFAAABACADNwAArw0AIK4FAACwDQAgtAUAABwAIAM3AACtDQAgrgUAAK4NACC0BQAAAQAgAzcAAKsNACCuBQAArA0AILQFAAABACAAAAAAAAGxBQAAAPUEAgGxBQAAAPcEAwU3AACiDQAgOAAAqQ0AIK4FAACjDQAgrwUAAKgNACC0BQAAhAIAIAc3AACgDQAgOAAApg0AIK4FAAChDQAgrwUAAKUNACCyBQAAHgAgswUAAB4AILQFAAABACALNwAA9ggAMDgAAPsIADCuBQAA9wgAMK8FAAD4CAAwsAUAAPkIACCxBQAA-ggAMLIFAAD6CAAwswUAAPoIADC0BQAA-ggAMLUFAAD8CAAwtgUAAP0IADAIDgAA6ggAIA8AAOsIACCIBAEAAAABngRAAAAAAdQEAQAAAAHwBAEAAAAB8QQIAAAAAfIEAQAAAAECAAAAIgAgNwAAgQkAIAMAAAAiACA3AACBCQAgOAAAgAkAIAEwAACkDQAwDg0AALMHACAOAACKBwAgDwAAtAcAIIUEAACxBwAwhgQAACAAEIcEAACxBwAwiAQBAAAAAZ4EQACwBgAh1AQBAK0GACHvBAEArQYAIfAEAQCvBgAh8QQIALIHACHyBAEArwYAIaoFAACwBwAgAgAAACIAIDAAAIAJACACAAAA_ggAIDAAAP8IACAKhQQAAP0IADCGBAAA_ggAEIcEAAD9CAAwiAQBAK0GACGeBEAAsAYAIdQEAQCtBgAh7wQBAK0GACHwBAEArwYAIfEECACyBwAh8gQBAK8GACEKhQQAAP0IADCGBAAA_ggAEIcEAAD9CAAwiAQBAK0GACGeBEAAsAYAIdQEAQCtBgAh7wQBAK0GACHwBAEArwYAIfEECACyBwAh8gQBAK8GACEGiAQBAM8HACGeBEAA0gcAIdQEAQDPBwAh8AQBANEHACHxBAgA5QgAIfIEAQDRBwAhCA4AAOcIACAPAADoCAAgiAQBAM8HACGeBEAA0gcAIdQEAQDPBwAh8AQBANEHACHxBAgA5QgAIfIEAQDRBwAhCA4AAOoIACAPAADrCAAgiAQBAAAAAZ4EQAAAAAHUBAEAAAAB8AQBAAAAAfEECAAAAAHyBAEAAAABAzcAAKINACCuBQAAow0AILQFAACEAgAgAzcAAKANACCuBQAAoQ0AILQFAAABACAENwAA9ggAMK4FAAD3CAAwsAUAAPkIACC0BQAA-ggAMAAAAAU3AACYDQAgOAAAng0AIK4FAACZDQAgrwUAAJ0NACC0BQAANQAgBTcAAJYNACA4AACbDQAgrgUAAJcNACCvBQAAmg0AILQFAAABACADNwAAmA0AIK4FAACZDQAgtAUAADUAIAM3AACWDQAgrgUAAJcNACC0BQAAAQAgAAAABTcAAI0NACA4AACUDQAgrgUAAI4NACCvBQAAkw0AILQFAACEAgAgBTcAAIsNACA4AACRDQAgrgUAAIwNACCvBQAAkA0AILQFAAABACALNwAAkgkAMDgAAJcJADCuBQAAkwkAMK8FAACUCQAwsAUAAJUJACCxBQAAlgkAMLIFAACWCQAwswUAAJYJADC0BQAAlgkAMLUFAACYCQAwtgUAAJkJADAFFQAAiwkAIIgEAQAAAAGeBEAAAAAB4gQBAAAAAeoEAQAAAAECAAAAOQAgNwAAnQkAIAMAAAA5ACA3AACdCQAgOAAAnAkAIAEwAACPDQAwChUAAIoHACAYAACmBwAghQQAAKUHADCGBAAANwAQhwQAAKUHADCIBAEAAAABngRAALAGACHiBAEArQYAIeoEAQCtBgAh-gQBAK0GACECAAAAOQAgMAAAnAkAIAIAAACaCQAgMAAAmwkAIAiFBAAAmQkAMIYEAACaCQAQhwQAAJkJADCIBAEArQYAIZ4EQACwBgAh4gQBAK0GACHqBAEArQYAIfoEAQCtBgAhCIUEAACZCQAwhgQAAJoJABCHBAAAmQkAMIgEAQCtBgAhngRAALAGACHiBAEArQYAIeoEAQCtBgAh-gQBAK0GACEEiAQBAM8HACGeBEAA0gcAIeIEAQDPBwAh6gQBAM8HACEFFQAAiQkAIIgEAQDPBwAhngRAANIHACHiBAEAzwcAIeoEAQDPBwAhBRUAAIsJACCIBAEAAAABngRAAAAAAeIEAQAAAAHqBAEAAAABAzcAAI0NACCuBQAAjg0AILQFAACEAgAgAzcAAIsNACCuBQAAjA0AILQFAAABACAENwAAkgkAMK4FAACTCQAwsAUAAJUJACC0BQAAlgkAMAAAAAU3AACDDQAgOAAAiQ0AIK4FAACEDQAgrwUAAIgNACC0BQAALAAgBTcAAIENACA4AACGDQAgrgUAAIINACCvBQAAhQ0AILQFAAABACADNwAAgw0AIK4FAACEDQAgtAUAACwAIAM3AACBDQAgrgUAAIINACC0BQAAAQAgAAAABTcAAPgMACA4AAD_DAAgrgUAAPkMACCvBQAA_gwAILQFAACEAgAgBTcAAPYMACA4AAD8DAAgrgUAAPcMACCvBQAA-wwAILQFAAABACALNwAArgkAMDgAALMJADCuBQAArwkAMK8FAACwCQAwsAUAALEJACCxBQAAsgkAMLIFAACyCQAwswUAALIJADC0BQAAsgkAMLUFAAC0CQAwtgUAALUJADAFFQAApwkAIIgEAQAAAAGeBEAAAAAB4gQBAAAAAeoEAQAAAAECAAAAMAAgNwAAuQkAIAMAAAAwACA3AAC5CQAgOAAAuAkAIAEwAAD6DAAwChQAAKsHACAVAACKBwAghQQAAKoHADCGBAAALgAQhwQAAKoHADCIBAEAAAABngRAALAGACHiBAEArQYAIeoEAQCtBgAh-wQBAK0GACECAAAAMAAgMAAAuAkAIAIAAAC2CQAgMAAAtwkAIAiFBAAAtQkAMIYEAAC2CQAQhwQAALUJADCIBAEArQYAIZ4EQACwBgAh4gQBAK0GACHqBAEArQYAIfsEAQCtBgAhCIUEAAC1CQAwhgQAALYJABCHBAAAtQkAMIgEAQCtBgAhngRAALAGACHiBAEArQYAIeoEAQCtBgAh-wQBAK0GACEEiAQBAM8HACGeBEAA0gcAIeIEAQDPBwAh6gQBAM8HACEFFQAApQkAIIgEAQDPBwAhngRAANIHACHiBAEAzwcAIeoEAQDPBwAhBRUAAKcJACCIBAEAAAABngRAAAAAAeIEAQAAAAHqBAEAAAABAzcAAPgMACCuBQAA-QwAILQFAACEAgAgAzcAAPYMACCuBQAA9wwAILQFAAABACAENwAArgkAMK4FAACvCQAwsAUAALEJACC0BQAAsgkAMAAAAAGxBQAAAP8EAgU3AADuDAAgOAAA9AwAIK4FAADvDAAgrwUAAPMMACC0BQAAAQAgBTcAAOwMACA4AADxDAAgrgUAAO0MACCvBQAA8AwAILQFAACEAgAgAzcAAO4MACCuBQAA7wwAILQFAAABACADNwAA7AwAIK4FAADtDAAgtAUAAIQCACAAAAAAAAs3AACMCgAwOAAAkQoAMK4FAACNCgAwrwUAAI4KADCwBQAAjwoAILEFAACQCgAwsgUAAJAKADCzBQAAkAoAMLQFAACQCgAwtQUAAJIKADC2BQAAkwoAMAs3AACACgAwOAAAhQoAMK4FAACBCgAwrwUAAIIKADCwBQAAgwoAILEFAACECgAwsgUAAIQKADCzBQAAhAoAMLQFAACECgAwtQUAAIYKADC2BQAAhwoAMAs3AAD0CQAwOAAA-QkAMK4FAAD1CQAwrwUAAPYJADCwBQAA9wkAILEFAAD4CQAwsgUAAPgJADCzBQAA-AkAMLQFAAD4CQAwtQUAAPoJADC2BQAA-wkAMAs3AADoCQAwOAAA7QkAMK4FAADpCQAwrwUAAOoJADCwBQAA6wkAILEFAADsCQAwsgUAAOwJADCzBQAA7AkAMLQFAADsCQAwtQUAAO4JADC2BQAA7wkAMAs3AADcCQAwOAAA4QkAMK4FAADdCQAwrwUAAN4JADCwBQAA3wkAILEFAADgCQAwsgUAAOAJADCzBQAA4AkAMLQFAADgCQAwtQUAAOIJADC2BQAA4wkAMAs3AADQCQAwOAAA1QkAMK4FAADRCQAwrwUAANIJADCwBQAA0wkAILEFAADUCQAwsgUAANQJADCzBQAA1AkAMLQFAADUCQAwtQUAANYJADC2BQAA1wkAMAcVAACfCQAgGQAAoAkAIIgEAQAAAAGeBEAAAAABrgQBAAAAAeIEAQAAAAHqBAEAAAABAgAAADUAIDcAANsJACADAAAANQAgNwAA2wkAIDgAANoJACABMAAA6wwAMAwKAACoBwAgFQAAigcAIBkAAKkHACCFBAAApwcAMIYEAAAzABCHBAAApwcAMIgEAQAAAAGeBEAAsAYAIa4EAQCtBgAh0wQBAK0GACHiBAEArQYAIeoEAQCtBgAhAgAAADUAIDAAANoJACACAAAA2AkAIDAAANkJACAJhQQAANcJADCGBAAA2AkAEIcEAADXCQAwiAQBAK0GACGeBEAAsAYAIa4EAQCtBgAh0wQBAK0GACHiBAEArQYAIeoEAQCtBgAhCYUEAADXCQAwhgQAANgJABCHBAAA1wkAMIgEAQCtBgAhngRAALAGACGuBAEArQYAIdMEAQCtBgAh4gQBAK0GACHqBAEArQYAIQWIBAEAzwcAIZ4EQADSBwAhrgQBAM8HACHiBAEAzwcAIeoEAQDPBwAhBxUAAJAJACAZAACRCQAgiAQBAM8HACGeBEAA0gcAIa4EAQDPBwAh4gQBAM8HACHqBAEAzwcAIQcVAACfCQAgGQAAoAkAIIgEAQAAAAGeBEAAAAABrgQBAAAAAeIEAQAAAAHqBAEAAAABCAwAALsJACAWAAC8CQAgiAQBAAAAAZ4EQAAAAAHqBAEAAAAB8wQBAAAAAfwEAQAAAAH9BAEAAAABAgAAACwAIDcAAOcJACADAAAALAAgNwAA5wkAIDgAAOYJACABMAAA6gwAMA0KAACoBwAgDAAAigcAIBYAAK0HACCFBAAArAcAMIYEAAAqABCHBAAArAcAMIgEAQAAAAGeBEAAsAYAIdMEAQCtBgAh6gQBAK0GACHzBAEArQYAIfwEAQCvBgAh_QQBAK8GACECAAAALAAgMAAA5gkAIAIAAADkCQAgMAAA5QkAIAqFBAAA4wkAMIYEAADkCQAQhwQAAOMJADCIBAEArQYAIZ4EQACwBgAh0wQBAK0GACHqBAEArQYAIfMEAQCtBgAh_AQBAK8GACH9BAEArwYAIQqFBAAA4wkAMIYEAADkCQAQhwQAAOMJADCIBAEArQYAIZ4EQACwBgAh0wQBAK0GACHqBAEArQYAIfMEAQCtBgAh_AQBAK8GACH9BAEArwYAIQaIBAEAzwcAIZ4EQADSBwAh6gQBAM8HACHzBAEAzwcAIfwEAQDRBwAh_QQBANEHACEIDAAArAkAIBYAAK0JACCIBAEAzwcAIZ4EQADSBwAh6gQBAM8HACHzBAEAzwcAIfwEAQDRBwAh_QQBANEHACEIDAAAuwkAIBYAALwJACCIBAEAAAABngRAAAAAAeoEAQAAAAHzBAEAAAAB_AQBAAAAAf0EAQAAAAEIDgAAoAgAIIgEAQAAAAGeBEAAAAAB1AQBAAAAAdUEAgAAAAHWBAEAAAAB1wQgAAAAAdgEgAAAAAECAAAAKAAgNwAA8wkAIAMAAAAoACA3AADzCQAgOAAA8gkAIAEwAADpDAAwDgoAAKgHACAOAACKBwAghQQAAK8HADCGBAAAJgAQhwQAAK8HADCIBAEAAAABngRAALAGACHTBAEArQYAIdQEAQCtBgAh1QQCALsGACHWBAEArwYAIdcEIACuBgAh2AQAAIEHACCpBQAArgcAIAIAAAAoACAwAADyCQAgAgAAAPAJACAwAADxCQAgC4UEAADvCQAwhgQAAPAJABCHBAAA7wkAMIgEAQCtBgAhngRAALAGACHTBAEArQYAIdQEAQCtBgAh1QQCALsGACHWBAEArwYAIdcEIACuBgAh2AQAAIEHACALhQQAAO8JADCGBAAA8AkAEIcEAADvCQAwiAQBAK0GACGeBEAAsAYAIdMEAQCtBgAh1AQBAK0GACHVBAIAuwYAIdYEAQCvBgAh1wQgAK4GACHYBAAAgQcAIAeIBAEAzwcAIZ4EQADSBwAh1AQBAM8HACHVBAIA3gcAIdYEAQDRBwAh1wQgANAHACHYBIAAAAABCA4AAJ4IACCIBAEAzwcAIZ4EQADSBwAh1AQBAM8HACHVBAIA3gcAIdYEAQDRBwAh1wQgANAHACHYBIAAAAABCA4AAKAIACCIBAEAAAABngRAAAAAAdQEAQAAAAHVBAIAAAAB1gQBAAAAAdcEIAAAAAHYBIAAAAABCwwAAIMJACAQAACECQAgiAQBAAAAAZ4EQAAAAAGuBAEAAAABrwQBAAAAAfMEAQAAAAH1BAAAAPUEAvcEAAAA9wQD-ARAAAAAAfkECAAAAAECAAAAHAAgNwAA_wkAIAMAAAAcACA3AAD_CQAgOAAA_gkAIAEwAADoDAAwEAoAAKgHACAMAAC0BwAgEAAAvAcAIIUEAADBBwAwhgQAABoAEIcEAADBBwAwiAQBAAAAAZ4EQACwBgAhrgQBAK0GACGvBAEArwYAIdMEAQCtBgAh8wQBAK8GACH1BAAAwgf1BCL3BAAAwwf3BCP4BEAAsAYAIfkECAD_BgAhAgAAABwAIDAAAP4JACACAAAA_AkAIDAAAP0JACANhQQAAPsJADCGBAAA_AkAEIcEAAD7CQAwiAQBAK0GACGeBEAAsAYAIa4EAQCtBgAhrwQBAK8GACHTBAEArQYAIfMEAQCvBgAh9QQAAMIH9QQi9wQAAMMH9wQj-ARAALAGACH5BAgA_wYAIQ2FBAAA-wkAMIYEAAD8CQAQhwQAAPsJADCIBAEArQYAIZ4EQACwBgAhrgQBAK0GACGvBAEArwYAIdMEAQCtBgAh8wQBAK8GACH1BAAAwgf1BCL3BAAAwwf3BCP4BEAAsAYAIfkECAD_BgAhCYgEAQDPBwAhngRAANIHACGuBAEAzwcAIa8EAQDRBwAh8wQBANEHACH1BAAA8Qj1BCL3BAAA8gj3BCP4BEAA0gcAIfkECADbCAAhCwwAAPQIACAQAAD1CAAgiAQBAM8HACGeBEAA0gcAIa4EAQDPBwAhrwQBANEHACHzBAEA0QcAIfUEAADxCPUEIvcEAADyCPcEI_gEQADSBwAh-QQIANsIACELDAAAgwkAIBAAAIQJACCIBAEAAAABngRAAAAAAa4EAQAAAAGvBAEAAAAB8wQBAAAAAfUEAAAA9QQC9wQAAAD3BAP4BEAAAAAB-QQIAAAAAQgJAADeCAAgiAQBAAAAAZ4EQAAAAAGuBAEAAAAB1QQIAAAAAewEAQAAAAHtBAEAAAAB7gQgAAAAAQIAAAAWACA3AACLCgAgAwAAABYAIDcAAIsKACA4AACKCgAgATAAAOcMADANCQAAigcAIAoAAMUHACCFBAAAxAcAMIYEAAAUABCHBAAAxAcAMIgEAQAAAAGeBEAAsAYAIa4EAQCtBgAh0wQBAK8GACHVBAgA_wYAIewEAQCtBgAh7QQBAK0GACHuBCAArgYAIQIAAAAWACAwAACKCgAgAgAAAIgKACAwAACJCgAgC4UEAACHCgAwhgQAAIgKABCHBAAAhwoAMIgEAQCtBgAhngRAALAGACGuBAEArQYAIdMEAQCvBgAh1QQIAP8GACHsBAEArQYAIe0EAQCtBgAh7gQgAK4GACELhQQAAIcKADCGBAAAiAoAEIcEAACHCgAwiAQBAK0GACGeBEAAsAYAIa4EAQCtBgAh0wQBAK8GACHVBAgA_wYAIewEAQCtBgAh7QQBAK0GACHuBCAArgYAIQeIBAEAzwcAIZ4EQADSBwAhrgQBAM8HACHVBAgA2wgAIewEAQDPBwAh7QQBAM8HACHuBCAA0AcAIQgJAADcCAAgiAQBAM8HACGeBEAA0gcAIa4EAQDPBwAh1QQIANsIACHsBAEAzwcAIe0EAQDPBwAh7gQgANAHACEICQAA3ggAIIgEAQAAAAGeBEAAAAABrgQBAAAAAdUECAAAAAHsBAEAAAAB7QQBAAAAAe4EIAAAAAEFAwAAwwkAIIgEAQAAAAGXBAEAAAABxQQgAAAAAf8EAAAA_wQCAgAAABEAIDcAAJcKACADAAAAEQAgNwAAlwoAIDgAAJYKACABMAAA5gwAMAsDAACKBwAgCgAAqAcAIIUEAADHBwAwhgQAAA8AEIcEAADHBwAwiAQBAAAAAZcEAQCtBgAhxQQgAK4GACHTBAEArQYAIf8EAADIB_8EIqsFAADGBwAgAgAAABEAIDAAAJYKACACAAAAlAoAIDAAAJUKACAIhQQAAJMKADCGBAAAlAoAEIcEAACTCgAwiAQBAK0GACGXBAEArQYAIcUEIACuBgAh0wQBAK0GACH_BAAAyAf_BCIIhQQAAJMKADCGBAAAlAoAEIcEAACTCgAwiAQBAK0GACGXBAEArQYAIcUEIACuBgAh0wQBAK0GACH_BAAAyAf_BCIEiAQBAM8HACGXBAEAzwcAIcUEIADQBwAh_wQAAMAJ_wQiBQMAAMEJACCIBAEAzwcAIZcEAQDPBwAhxQQgANAHACH_BAAAwAn_BCIFAwAAwwkAIIgEAQAAAAGXBAEAAAABxQQgAAAAAf8EAAAA_wQCBDcAAIwKADCuBQAAjQoAMLAFAACPCgAgtAUAAJAKADAENwAAgAoAMK4FAACBCgAwsAUAAIMKACC0BQAAhAoAMAQ3AAD0CQAwrgUAAPUJADCwBQAA9wkAILQFAAD4CQAwBDcAAOgJADCuBQAA6QkAMLAFAADrCQAgtAUAAOwJADAENwAA3AkAMK4FAADdCQAwsAUAAN8JACC0BQAA4AkAMAQ3AADQCQAwrgUAANEJADCwBQAA0wkAILQFAADUCQAwAAAAAAAAAAAAArEFAQAAAAS3BQEAAAAFBTcAAOEMACA4AADkDAAgrgUAAOIMACCvBQAA4wwAILQFAAABACABsQUBAAAABAM3AADhDAAgrgUAAOIMACC0BQAAAQAgGAQAAK0MACAFAACuDAAgBgAArwwAIAcAALAMACALAACfCgAgEAAAsQwAIBMAAKEKACAbAACeCgAgHAAAoAoAIB0AALEMACAhAACyDAAgIgAAswwAICMAALQMACAkAAC1DAAgJQAAtgwAICYAALcMACAnAACiCgAgKAAAowoAICkAALgMACAqAAC5DAAgqgQAAMsHACDmBAAAywcAIP8EAADLBwAgqAUAAMsHACAAAAAAAAKxBQEAAAAEtwUBAAAABQU3AADcDAAgOAAA3wwAIK4FAADdDAAgrwUAAN4MACC0BQAAAQAgAbEFAQAAAAQDNwAA3AwAIK4FAADdDAAgtAUAAAEAIAAAAAAAAAU3AADXDAAgOAAA2gwAIK4FAADYDAAgrwUAANkMACC0BQAAAQAgAzcAANcMACCuBQAA2AwAILQFAAABACAAAAAFNwAA0gwAIDgAANUMACCuBQAA0wwAIK8FAADUDAAgtAUAAAEAIAM3AADSDAAgrgUAANMMACC0BQAAAQAgAAAAAbEFAAAAqAUDAbEFAAAA5gQDCzcAAI0MADA4AACSDAAwrgUAAI4MADCvBQAAjwwAMLAFAACQDAAgsQUAAJEMADCyBQAAkQwAMLMFAACRDAAwtAUAAJEMADC1BQAAkwwAMLYFAACUDAAwCzcAAIEMADA4AACGDAAwrgUAAIIMADCvBQAAgwwAMLAFAACEDAAgsQUAAIUMADCyBQAAhQwAMLMFAACFDAAwtAUAAIUMADC1BQAAhwwAMLYFAACIDAAwBzcAAPwLACA4AAD_CwAgrgUAAP0LACCvBQAA_gsAILIFAAALACCzBQAACwAgtAUAANQBACAHNwAA9wsAIDgAAPoLACCuBQAA-AsAIK8FAAD5CwAgsgUAAA0AILMFAAANACC0BQAA7AEAIAs3AADuCwAwOAAA8gsAMK4FAADvCwAwrwUAAPALADCwBQAA8QsAILEFAACQCgAwsgUAAJAKADCzBQAAkAoAMLQFAACQCgAwtQUAAPMLADC2BQAAkwoAMAs3AADlCwAwOAAA6QsAMK4FAADmCwAwrwUAAOcLADCwBQAA6AsAILEFAACECgAwsgUAAIQKADCzBQAAhAoAMLQFAACECgAwtQUAAOoLADC2BQAAhwoAMAs3AADcCwAwOAAA4AsAMK4FAADdCwAwrwUAAN4LADCwBQAA3wsAILEFAAD4CQAwsgUAAPgJADCzBQAA-AkAMLQFAAD4CQAwtQUAAOELADC2BQAA-wkAMAs3AADTCwAwOAAA1wsAMK4FAADUCwAwrwUAANULADCwBQAA1gsAILEFAAD6CAAwsgUAAPoIADCzBQAA-ggAMLQFAAD6CAAwtQUAANgLADC2BQAA_QgAMAs3AADKCwAwOAAAzgsAMK4FAADLCwAwrwUAAMwLADCwBQAAzQsAILEFAAD6CAAwsgUAAPoIADCzBQAA-ggAMLQFAAD6CAAwtQUAAM8LADC2BQAA_QgAMAs3AAC-CwAwOAAAwwsAMK4FAAC_CwAwrwUAAMALADCwBQAAwQsAILEFAADCCwAwsgUAAMILADCzBQAAwgsAMLQFAADCCwAwtQUAAMQLADC2BQAAxQsAMAs3AAC1CwAwOAAAuQsAMK4FAAC2CwAwrwUAALcLADCwBQAAuAsAILEFAADMCAAwsgUAAMwIADCzBQAAzAgAMLQFAADMCAAwtQUAALoLADC2BQAAzwgAMAs3AACpCwAwOAAArgsAMK4FAACqCwAwrwUAAKsLADCwBQAArAsAILEFAACtCwAwsgUAAK0LADCzBQAArQsAMLQFAACtCwAwtQUAAK8LADC2BQAAsAsAMAs3AACgCwAwOAAApAsAMK4FAAChCwAwrwUAAKILADCwBQAAowsAILEFAADsCQAwsgUAAOwJADCzBQAA7AkAMLQFAADsCQAwtQUAAKULADC2BQAA7wkAMAs3AACXCwAwOAAAmwsAMK4FAACYCwAwrwUAAJkLADCwBQAAmgsAILEFAACyCAAwsgUAALIIADCzBQAAsggAMLQFAACyCAAwtQUAAJwLADC2BQAAtQgAMAs3AACLCwAwOAAAkAsAMK4FAACMCwAwrwUAAI0LADCwBQAAjgsAILEFAACPCwAwsgUAAI8LADCzBQAAjwsAMLQFAACPCwAwtQUAAJELADC2BQAAkgsAMAs3AAD_CgAwOAAAhAsAMK4FAACACwAwrwUAAIELADCwBQAAggsAILEFAACDCwAwsgUAAIMLADCzBQAAgwsAMLQFAACDCwAwtQUAAIULADC2BQAAhgsAMAs3AAD2CgAwOAAA-goAMK4FAAD3CgAwrwUAAPgKADCwBQAA-QoAILEFAADgCQAwsgUAAOAJADCzBQAA4AkAMLQFAADgCQAwtQUAAPsKADC2BQAA4wkAMAs3AADtCgAwOAAA8QoAMK4FAADuCgAwrwUAAO8KADCwBQAA8AoAILEFAADUCQAwsgUAANQJADCzBQAA1AkAMLQFAADUCQAwtQUAAPIKADC2BQAA1wkAMAs3AADkCgAwOAAA6AoAMK4FAADlCgAwrwUAAOYKADCwBQAA5woAILEFAACWCQAwsgUAAJYJADCzBQAAlgkAMLQFAACWCQAwtQUAAOkKADC2BQAAmQkAMAs3AADbCgAwOAAA3woAMK4FAADcCgAwrwUAAN0KADCwBQAA3goAILEFAACyCQAwsgUAALIJADCzBQAAsgkAMLQFAACyCQAwtQUAAOAKADC2BQAAtQkAMAUUAACmCQAgiAQBAAAAAZ4EQAAAAAHqBAEAAAAB-wQBAAAAAQIAAAAwACA3AADjCgAgAwAAADAAIDcAAOMKACA4AADiCgAgATAAANEMADACAAAAMAAgMAAA4goAIAIAAAC2CQAgMAAA4QoAIASIBAEAzwcAIZ4EQADSBwAh6gQBAM8HACH7BAEAzwcAIQUUAACkCQAgiAQBAM8HACGeBEAA0gcAIeoEAQDPBwAh-wQBAM8HACEFFAAApgkAIIgEAQAAAAGeBEAAAAAB6gQBAAAAAfsEAQAAAAEFGAAAigkAIIgEAQAAAAGeBEAAAAAB6gQBAAAAAfoEAQAAAAECAAAAOQAgNwAA7AoAIAMAAAA5ACA3AADsCgAgOAAA6woAIAEwAADQDAAwAgAAADkAIDAAAOsKACACAAAAmgkAIDAAAOoKACAEiAQBAM8HACGeBEAA0gcAIeoEAQDPBwAh-gQBAM8HACEFGAAAiAkAIIgEAQDPBwAhngRAANIHACHqBAEAzwcAIfoEAQDPBwAhBRgAAIoJACCIBAEAAAABngRAAAAAAeoEAQAAAAH6BAEAAAABBwoAAJ4JACAZAACgCQAgiAQBAAAAAZ4EQAAAAAGuBAEAAAAB0wQBAAAAAeoEAQAAAAECAAAANQAgNwAA9QoAIAMAAAA1ACA3AAD1CgAgOAAA9AoAIAEwAADPDAAwAgAAADUAIDAAAPQKACACAAAA2AkAIDAAAPMKACAFiAQBAM8HACGeBEAA0gcAIa4EAQDPBwAh0wQBAM8HACHqBAEAzwcAIQcKAACPCQAgGQAAkQkAIIgEAQDPBwAhngRAANIHACGuBAEAzwcAIdMEAQDPBwAh6gQBAM8HACEHCgAAngkAIBkAAKAJACCIBAEAAAABngRAAAAAAa4EAQAAAAHTBAEAAAAB6gQBAAAAAQgKAAC6CQAgFgAAvAkAIIgEAQAAAAGeBEAAAAAB0wQBAAAAAeoEAQAAAAH8BAEAAAAB_QQBAAAAAQIAAAAsACA3AAD-CgAgAwAAACwAIDcAAP4KACA4AAD9CgAgATAAAM4MADACAAAALAAgMAAA_QoAIAIAAADkCQAgMAAA_AoAIAaIBAEAzwcAIZ4EQADSBwAh0wQBAM8HACHqBAEAzwcAIfwEAQDRBwAh_QQBANEHACEICgAAqwkAIBYAAK0JACCIBAEAzwcAIZ4EQADSBwAh0wQBAM8HACHqBAEAzwcAIfwEAQDRBwAh_QQBANEHACEICgAAugkAIBYAALwJACCIBAEAAAABngRAAAAAAdMEAQAAAAHqBAEAAAAB_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_ggAIDAAANALACAGiAQBAM8HACGeBEAA0gcAIdQEAQDPBwAh7wQBAM8HACHwBAEA0QcAIfEECADlCAAhCA0AAOYIACAOAADnCAAgiAQBAM8HACGeBEAA0gcAIdQEAQDPBwAh7wQBAM8HACHwBAEA0QcAIfEECADlCAAhCA0AAOkIACAOAADqCAAgiAQBAAAAAZ4EQAAAAAHUBAEAAAAB7wQBAAAAAfAEAQAAAAHxBAgAAAABCA0AAOkIACAPAADrCAAgiAQBAAAAAZ4EQAAAAAHvBAEAAAAB8AQBAAAAAfEECAAAAAHyBAEAAAABAgAAACIAIDcAANsLACADAAAAIgAgNwAA2wsAIDgAANoLACABMAAAxQwAMAIAAAAiACAwAADaCwAgAgAAAP4IACAwAADZCwAgBogEAQDPBwAhngRAANIHACHvBAEAzwcAIfAEAQDRBwAh8QQIAOUIACHyBAEA0QcAIQgNAADmCAAgDwAA6AgAIIgEAQDPBwAhngRAANIHACHvBAEAzwcAIfAEAQDRBwAh8QQIAOUIACHyBAEA0QcAIQgNAADpCAAgDwAA6wgAIIgEAQAAAAGeBEAAAAAB7wQBAAAAAfAEAQAAAAHxBAgAAAAB8gQBAAAAAQsKAACCCQAgEAAAhAkAIIgEAQAAAAGeBEAAAAABrgQBAAAAAa8EAQAAAAHTBAEAAAAB9QQAAAD1BAL3BAAAAPcEA_gEQAAAAAH5BAgAAAABAgAAABwAIDcAAOQLACADAAAAHAAgNwAA5AsAIDgAAOMLACABMAAAxAwAMAIAAAAcACAwAADjCwAgAgAAAPwJACAwAADiCwAgCYgEAQDPBwAhngRAANIHACGuBAEAzwcAIa8EAQDRBwAh0wQBAM8HACH1BAAA8Qj1BCL3BAAA8gj3BCP4BEAA0gcAIfkECADbCAAhCwoAAPMIACAQAAD1CAAgiAQBAM8HACGeBEAA0gcAIa4EAQDPBwAhrwQBANEHACHTBAEAzwcAIfUEAADxCPUEIvcEAADyCPcEI_gEQADSBwAh-QQIANsIACELCgAAggkAIBAAAIQJACCIBAEAAAABngRAAAAAAa4EAQAAAAGvBAEAAAAB0wQBAAAAAfUEAAAA9QQC9wQAAAD3BAP4BEAAAAAB-QQIAAAAAQgKAADfCAAgiAQBAAAAAZ4EQAAAAAGuBAEAAAAB0wQBAAAAAdUECAAAAAHsBAEAAAAB7gQgAAAAAQIAAAAWACA3AADtCwAgAwAAABYAIDcAAO0LACA4AADsCwAgATAAAMMMADACAAAAFgAgMAAA7AsAIAIAAACICgAgMAAA6wsAIAeIBAEAzwcAIZ4EQADSBwAhrgQBAM8HACHTBAEA0QcAIdUECADbCAAh7AQBAM8HACHuBCAA0AcAIQgKAADdCAAgiAQBAM8HACGeBEAA0gcAIa4EAQDPBwAh0wQBANEHACHVBAgA2wgAIewEAQDPBwAh7gQgANAHACEICgAA3wgAIIgEAQAAAAGeBEAAAAABrgQBAAAAAdMEAQAAAAHVBAgAAAAB7AQBAAAAAe4EIAAAAAEFCgAAxAkAIIgEAQAAAAHFBCAAAAAB0wQBAAAAAf8EAAAA_wQCAgAAABEAIDcAAPYLACADAAAAEQAgNwAA9gsAIDgAAPULACABMAAAwgwAMAIAAAARACAwAAD1CwAgAgAAAJQKACAwAAD0CwAgBIgEAQDPBwAhxQQgANAHACHTBAEAzwcAIf8EAADACf8EIgUKAADCCQAgiAQBAM8HACHFBCAA0AcAIdMEAQDPBwAh_wQAAMAJ_wQiBQoAAMQJACCIBAEAAAABxQQgAAAAAdMEAQAAAAH_BAAAAP8EAguIBAEAAAABowQBAAAAAagEAQAAAAGpBAEAAAABiwUBAAAAAYwFAQAAAAGNBQEAAAABjgUBAAAAAY8FAQAAAAGQBQAAqQoAIJEFgAAAAAECAAAA7AEAIDcAAPcLACADAAAADQAgNwAA9wsAIDgAAPsLACANAAAADQAgMAAA-wsAIIgEAQDPBwAhowQBAM8HACGoBAEA0QcAIakEAQDRBwAhiwUBAM8HACGMBQEAzwcAIY0FAQDPBwAhjgUBANEHACGPBQEA0QcAIZAFAACnCgAgkQWAAAAAAQuIBAEAzwcAIaMEAQDPBwAhqAQBANEHACGpBAEA0QcAIYsFAQDPBwAhjAUBAM8HACGNBQEAzwcAIY4FAQDRBwAhjwUBANEHACGQBQAApwoAIJEFgAAAAAENiAQBAAAAAaEEAQAAAAGjBAEAAAABpwQAALMKACCoBAEAAAABqQQBAAAAAdQEAQAAAAGNBQEAAAABkgUBAAAAAZMFAgAAAAGUBQEAAAABlQUgAAAAAZYFIAAAAAECAAAA1AEAIDcAAPwLACADAAAACwAgNwAA_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_QsAILQFAADUAQAgAzcAAPcLACCuBQAA-AsAILQFAADsAQAgBDcAAO4LADCuBQAA7wsAMLAFAADxCwAgtAUAAJAKADAENwAA5QsAMK4FAADmCwAwsAUAAOgLACC0BQAAhAoAMAQ3AADcCwAwrgUAAN0LADCwBQAA3wsAILQFAAD4CQAwBDcAANMLADCuBQAA1AsAMLAFAADWCwAgtAUAAPoIADAENwAAygsAMK4FAADLCwAwsAUAAM0LACC0BQAA-ggAMAQ3AAC-CwAwrgUAAL8LADCwBQAAwQsAILQFAADCCwAwBDcAALULADCuBQAAtgsAMLAFAAC4CwAgtAUAAMwIADAENwAAqQsAMK4FAACqCwAwsAUAAKwLACC0BQAArQsAMAQ3AACgCwAwrgUAAKELADCwBQAAowsAILQFAADsCQAwBDcAAJcLADCuBQAAmAsAMLAFAACaCwAgtAUAALIIADAENwAAiwsAMK4FAACMCwAwsAUAAI4LACC0BQAAjwsAMAQ3AAD_CgAwrgUAAIALADCwBQAAggsAILQFAACDCwAwBDcAAPYKADCuBQAA9woAMLAFAAD5CgAgtAUAAOAJADAENwAA7QoAMK4FAADuCgAwsAUAAPAKACC0BQAA1AkAMAQ3AADkCgAwrgUAAOUKADCwBQAA5woAILQFAACWCQAwBDcAANsKADCuBQAA3AoAMLAFAADeCgAgtAUAALIJADAAAAMDAACrCgAgqAQAAMsHACCpBAAAywcAIAYDAACrCgAgqAQAAMsHACCpBAAAywcAII4FAADLBwAgjwUAAMsHACCRBQAAywcAIAAAAAAAAAAAAAIVAACrCgAgIAAAtQwAIAIVAACrCgAgIAAAswwAIAMKAAC9DAAgFQAAqwoAIBkAALgMACAICAAAngoAIAsAAJ8KACASAACgCgAgEwAAoQoAIBcAAKIKACAaAACjCgAghQUAAMsHACCKBQAAywcAIAUKAAC9DAAgDAAAqwoAIBYAALkMACD8BAAAywcAIP0EAADLBwAgBgoAAL0MACAMAACrCgAgEAAAsQwAIK8EAADLBwAg8wQAAMsHACD3BAAAywcAIAeIBAEAAAABiwRAAAAAAZ4EQAAAAAGZBUAAAAABowUBAAAAAaQFAQAAAAGlBQEAAAABDIgEAQAAAAGLBEAAAAABngRAAAAAAZoFAQAAAAGbBQEAAAABnAUBAAAAAZ0FAQAAAAGeBQEAAAABnwVAAAAAAaAFQAAAAAGhBQEAAAABogUBAAAAAQSIBAEAAAABxQQgAAAAAdMEAQAAAAH_BAAAAP8EAgeIBAEAAAABngRAAAAAAa4EAQAAAAHTBAEAAAAB1QQIAAAAAewEAQAAAAHuBCAAAAABCYgEAQAAAAGeBEAAAAABrgQBAAAAAa8EAQAAAAHTBAEAAAAB9QQAAAD1BAL3BAAAAPcEA_gEQAAAAAH5BAgAAAABBogEAQAAAAGeBEAAAAAB7wQBAAAAAfAEAQAAAAHxBAgAAAAB8gQBAAAAAQaIBAEAAAABngRAAAAAAdQEAQAAAAHvBAEAAAAB8AQBAAAAAfEECAAAAAEFiAQBAAAAAZ4EQAAAAAGuBAEAAAABrwQBAAAAAesEIAAAAAEEiAQBAAAAAZ4EQAAAAAHfBAEAAAAB6gQBAAAAAQmIBAEAAAABngRAAAAAAbIEAQAAAAHjBAEAAAAB5AQBAAAAAeYEAAAA5gQC5wQBAAAAAegEAQAAAAHpBCAAAAABB4gEAQAAAAGeBEAAAAAB0wQBAAAAAdUEAgAAAAHWBAEAAAAB1wQgAAAAAdgEgAAAAAEEiAQBAAAAAZ4EQAAAAAHfBAEAAAAB4QQBAAAAAQeIBAEAAAABiwRAAAAAAZ0EAAAAsgQCngRAAAAAAa4EAQAAAAGvBAEAAAABsAQBAAAAAQiIBAEAAAABiwRAAAAAAZgEAQAAAAGZBEAAAAABmgRAAAAAAZsEQAAAAAGdBAAAAJ0EAp4EQAAAAAEGiAQBAAAAAZ4EQAAAAAHTBAEAAAAB6gQBAAAAAfwEAQAAAAH9BAEAAAABBYgEAQAAAAGeBEAAAAABrgQBAAAAAdMEAQAAAAHqBAEAAAABBIgEAQAAAAGeBEAAAAAB6gQBAAAAAfoEAQAAAAEEiAQBAAAAAZ4EQAAAAAHqBAEAAAAB-wQBAAAAAR0FAACaDAAgBgAAmwwAIAcAAJwMACALAACeDAAgEAAAoAwAIBMAAKUMACAbAACdDAAgHAAAnwwAIB0AAKEMACAhAACiDAAgIgAAowwAICMAAKQMACAkAACmDAAgJQAApwwAICYAAKgMACAnAACpDAAgKAAAqgwAICkAAKsMACAqAACsDAAgiAQBAAAAAYsEQAAAAAGeBEAAAAABnwQBAAAAAaAEAQAAAAGqBAEAAAAB5gQAAADmBAP_BAAAAKgFA6YFIAAAAAGoBQEAAAABAgAAAAEAIDcAANIMACADAAAAHgAgNwAA0gwAIDgAANYMACAfAAAAHgAgBQAAyAoAIAYAAMkKACAHAADKCgAgCwAAzAoAIBAAAM4KACATAADTCgAgGwAAywoAIBwAAM0KACAdAADPCgAgIQAA0AoAICIAANEKACAjAADSCgAgJAAA1AoAICUAANUKACAmAADWCgAgJwAA1woAICgAANgKACApAADZCgAgKgAA2goAIDAAANYMACCIBAEAzwcAIYsEQADSBwAhngRAANIHACGfBAEAzwcAIaAEAQDPBwAhqgQBANEHACHmBAAAxgrmBCP_BAAAxQqoBSOmBSAA0AcAIagFAQDRBwAhHQUAAMgKACAGAADJCgAgBwAAygoAIAsAAMwKACAQAADOCgAgEwAA0woAIBsAAMsKACAcAADNCgAgHQAAzwoAICEAANAKACAiAADRCgAgIwAA0goAICQAANQKACAlAADVCgAgJgAA1goAICcAANcKACAoAADYCgAgKQAA2QoAICoAANoKACCIBAEAzwcAIYsEQADSBwAhngRAANIHACGfBAEAzwcAIaAEAQDPBwAhqgQBANEHACHmBAAAxgrmBCP_BAAAxQqoBSOmBSAA0AcAIagFAQDRBwAhHQQAAJkMACAGAACbDAAgBwAAnAwAIAsAAJ4MACAQAACgDAAgEwAApQwAIBsAAJ0MACAcAACfDAAgHQAAoQwAICEAAKIMACAiAACjDAAgIwAApAwAICQAAKYMACAlAACnDAAgJgAAqAwAICcAAKkMACAoAACqDAAgKQAAqwwAICoAAKwMACCIBAEAAAABiwRAAAAAAZ4EQAAAAAGfBAEAAAABoAQBAAAAAaoEAQAAAAHmBAAAAOYEA_8EAAAAqAUDpgUgAAAAAagFAQAAAAECAAAAAQAgNwAA1wwAIAMAAAAeACA3AADXDAAgOAAA2wwAIB8AAAAeACAEAADHCgAgBgAAyQoAIAcAAMoKACALAADMCgAgEAAAzgoAIBMAANMKACAbAADLCgAgHAAAzQoAIB0AAM8KACAhAADQCgAgIgAA0QoAICMAANIKACAkAADUCgAgJQAA1QoAICYAANYKACAnAADXCgAgKAAA2AoAICkAANkKACAqAADaCgAgMAAA2wwAIIgEAQDPBwAhiwRAANIHACGeBEAA0gcAIZ8EAQDPBwAhoAQBAM8HACGqBAEA0QcAIeYEAADGCuYEI_8EAADFCqgFI6YFIADQBwAhqAUBANEHACEdBAAAxwoAIAYAAMkKACAHAADKCgAgCwAAzAoAIBAAAM4KACATAADTCgAgGwAAywoAIBwAAM0KACAdAADPCgAgIQAA0AoAICIAANEKACAjAADSCgAgJAAA1AoAICUAANUKACAmAADWCgAgJwAA1woAICgAANgKACApAADZCgAgKgAA2goAIIgEAQDPBwAhiwRAANIHACGeBEAA0gcAIZ8EAQDPBwAhoAQBAM8HACGqBAEA0QcAIeYEAADGCuYEI_8EAADFCqgFI6YFIADQBwAhqAUBANEHACEdBAAAmQwAIAUAAJoMACAHAACcDAAgCwAAngwAIBAAAKAMACATAAClDAAgGwAAnQwAIBwAAJ8MACAdAAChDAAgIQAAogwAICIAAKMMACAjAACkDAAgJAAApgwAICUAAKcMACAmAACoDAAgJwAAqQwAICgAAKoMACApAACrDAAgKgAArAwAIIgEAQAAAAGLBEAAAAABngRAAAAAAZ8EAQAAAAGgBAEAAAABqgQBAAAAAeYEAAAA5gQD_wQAAACoBQOmBSAAAAABqAUBAAAAAQIAAAABACA3AADcDAAgAwAAAB4AIDcAANwMACA4AADgDAAgHwAAAB4AIAQAAMcKACAFAADICgAgBwAAygoAIAsAAMwKACAQAADOCgAgEwAA0woAIBsAAMsKACAcAADNCgAgHQAAzwoAICEAANAKACAiAADRCgAgIwAA0goAICQAANQKACAlAADVCgAgJgAA1goAICcAANcKACAoAADYCgAgKQAA2QoAICoAANoKACAwAADgDAAgiAQBAM8HACGLBEAA0gcAIZ4EQADSBwAhnwQBAM8HACGgBAEAzwcAIaoEAQDRBwAh5gQAAMYK5gQj_wQAAMUKqAUjpgUgANAHACGoBQEA0QcAIR0EAADHCgAgBQAAyAoAIAcAAMoKACALAADMCgAgEAAAzgoAIBMAANMKACAbAADLCgAgHAAAzQoAIB0AAM8KACAhAADQCgAgIgAA0QoAICMAANIKACAkAADUCgAgJQAA1QoAICYAANYKACAnAADXCgAgKAAA2AoAICkAANkKACAqAADaCgAgiAQBAM8HACGLBEAA0gcAIZ4EQADSBwAhnwQBAM8HACGgBAEAzwcAIaoEAQDRBwAh5gQAAMYK5gQj_wQAAMUKqAUjpgUgANAHACGoBQEA0QcAIR0EAACZDAAgBQAAmgwAIAYAAJsMACALAACeDAAgEAAAoAwAIBMAAKUMACAbAACdDAAgHAAAnwwAIB0AAKEMACAhAACiDAAgIgAAowwAICMAAKQMACAkAACmDAAgJQAApwwAICYAAKgMACAnAACpDAAgKAAAqgwAICkAAKsMACAqAACsDAAgiAQBAAAAAYsEQAAAAAGeBEAAAAABnwQBAAAAAaAEAQAAAAGqBAEAAAAB5gQAAADmBAP_BAAAAKgFA6YFIAAAAAGoBQEAAAABAgAAAAEAIDcAAOEMACADAAAAHgAgNwAA4QwAIDgAAOUMACAfAAAAHgAgBAAAxwoAIAUAAMgKACAGAADJCgAgCwAAzAoAIBAAAM4KACATAADTCgAgGwAAywoAIBwAAM0KACAdAADPCgAgIQAA0AoAICIAANEKACAjAADSCgAgJAAA1AoAICUAANUKACAmAADWCgAgJwAA1woAICgAANgKACApAADZCgAgKgAA2goAIDAAAOUMACCIBAEAzwcAIYsEQADSBwAhngRAANIHACGfBAEAzwcAIaAEAQDPBwAhqgQBANEHACHmBAAAxgrmBCP_BAAAxQqoBSOmBSAA0AcAIagFAQDRBwAhHQQAAMcKACAFAADICgAgBgAAyQoAIAsAAMwKACAQAADOCgAgEwAA0woAIBsAAMsKACAcAADNCgAgHQAAzwoAICEAANAKACAiAADRCgAgIwAA0goAICQAANQKACAlAADVCgAgJgAA1goAICcAANcKACAoAADYCgAgKQAA2QoAICoAANoKACCIBAEAzwcAIYsEQADSBwAhngRAANIHACGfBAEAzwcAIaAEAQDPBwAhqgQBANEHACHmBAAAxgrmBCP_BAAAxQqoBSOmBSAA0AcAIagFAQDRBwAhBIgEAQAAAAGXBAEAAAABxQQgAAAAAf8EAAAA_wQCB4gEAQAAAAGeBEAAAAABrgQBAAAAAdUECAAAAAHsBAEAAAAB7QQBAAAAAe4EIAAAAAEJiAQBAAAAAZ4EQAAAAAGuBAEAAAABrwQBAAAAAfMEAQAAAAH1BAAAAPUEAvcEAAAA9wQD-ARAAAAAAfkECAAAAAEHiAQBAAAAAZ4EQAAAAAHUBAEAAAAB1QQCAAAAAdYEAQAAAAHXBCAAAAAB2ASAAAAAAQaIBAEAAAABngRAAAAAAeoEAQAAAAHzBAEAAAAB_AQBAAAAAf0EAQAAAAEFiAQBAAAAAZ4EQAAAAAGuBAEAAAAB4gQBAAAAAeoEAQAAAAEUCwAAmQoAIBIAAJoKACATAACbCgAgFwAAnAoAIBoAAJ0KACCIBAEAAAABngRAAAAAAaEEAQAAAAGjBAEAAAABgAUBAAAAAYEFAQAAAAGCBQgAAAABgwUBAAAAAYQFgAAAAAGFBYAAAAABhgUBAAAAAYcFIAAAAAGIBQIAAAABiQUgAAAAAYoFgAAAAAECAAAAhAIAIDcAAOwMACAdBAAAmQwAIAUAAJoMACAGAACbDAAgBwAAnAwAIAsAAJ4MACAQAACgDAAgEwAApQwAIBwAAJ8MACAdAAChDAAgIQAAogwAICIAAKMMACAjAACkDAAgJAAApgwAICUAAKcMACAmAACoDAAgJwAAqQwAICgAAKoMACApAACrDAAgKgAArAwAIIgEAQAAAAGLBEAAAAABngRAAAAAAZ8EAQAAAAGgBAEAAAABqgQBAAAAAeYEAAAA5gQD_wQAAACoBQOmBSAAAAABqAUBAAAAAQIAAAABACA3AADuDAAgAwAAABgAIDcAAOwMACA4AADyDAAgFgAAABgAIAsAAMsJACASAADMCQAgEwAAzQkAIBcAAM4JACAaAADPCQAgMAAA8gwAIIgEAQDPBwAhngRAANIHACGhBAEAzwcAIaMEAQDPBwAhgAUBAM8HACGBBQEAzwcAIYIFCADbCAAhgwUBAM8HACGEBYAAAAABhQWAAAAAAYYFAQDPBwAhhwUgANAHACGIBQIA3gcAIYkFIADQBwAhigWAAAAAARQLAADLCQAgEgAAzAkAIBMAAM0JACAXAADOCQAgGgAAzwkAIIgEAQDPBwAhngRAANIHACGhBAEAzwcAIaMEAQDPBwAhgAUBAM8HACGBBQEAzwcAIYIFCADbCAAhgwUBAM8HACGEBYAAAAABhQWAAAAAAYYFAQDPBwAhhwUgANAHACGIBQIA3gcAIYkFIADQBwAhigWAAAAAAQMAAAAeACA3AADuDAAgOAAA9QwAIB8AAAAeACAEAADHCgAgBQAAyAoAIAYAAMkKACAHAADKCgAgCwAAzAoAIBAAAM4KACATAADTCgAgHAAAzQoAIB0AAM8KACAhAADQCgAgIgAA0QoAICMAANIKACAkAADUCgAgJQAA1QoAICYAANYKACAnAADXCgAgKAAA2AoAICkAANkKACAqAADaCgAgMAAA9QwAIIgEAQDPBwAhiwRAANIHACGeBEAA0gcAIZ8EAQDPBwAhoAQBAM8HACGqBAEA0QcAIeYEAADGCuYEI_8EAADFCqgFI6YFIADQBwAhqAUBANEHACEdBAAAxwoAIAUAAMgKACAGAADJCgAgBwAAygoAIAsAAMwKACAQAADOCgAgEwAA0woAIBwAAM0KACAdAADPCgAgIQAA0AoAICIAANEKACAjAADSCgAgJAAA1AoAICUAANUKACAmAADWCgAgJwAA1woAICgAANgKACApAADZCgAgKgAA2goAIIgEAQDPBwAhiwRAANIHACGeBEAA0gcAIZ8EAQDPBwAhoAQBAM8HACGqBAEA0QcAIeYEAADGCuYEI_8EAADFCqgFI6YFIADQBwAhqAUBANEHACEdBAAAmQwAIAUAAJoMACAGAACbDAAgBwAAnAwAIAsAAJ4MACAQAACgDAAgEwAApQwAIBsAAJ0MACAcAACfDAAgHQAAoQwAICEAAKIMACAiAACjDAAgIwAApAwAICQAAKYMACAlAACnDAAgJgAAqAwAICgAAKoMACApAACrDAAgKgAArAwAIIgEAQAAAAGLBEAAAAABngRAAAAAAZ8EAQAAAAGgBAEAAAABqgQBAAAAAeYEAAAA5gQD_wQAAACoBQOmBSAAAAABqAUBAAAAAQIAAAABACA3AAD2DAAgFAgAAJgKACALAACZCgAgEgAAmgoAIBMAAJsKACAaAACdCgAgiAQBAAAAAZ4EQAAAAAGhBAEAAAABowQBAAAAAYAFAQAAAAGBBQEAAAABggUIAAAAAYMFAQAAAAGEBYAAAAABhQWAAAAAAYYFAQAAAAGHBSAAAAABiAUCAAAAAYkFIAAAAAGKBYAAAAABAgAAAIQCACA3AAD4DAAgBIgEAQAAAAGeBEAAAAAB4gQBAAAAAeoEAQAAAAEDAAAAHgAgNwAA9gwAIDgAAP0MACAfAAAAHgAgBAAAxwoAIAUAAMgKACAGAADJCgAgBwAAygoAIAsAAMwKACAQAADOCgAgEwAA0woAIBsAAMsKACAcAADNCgAgHQAAzwoAICEAANAKACAiAADRCgAgIwAA0goAICQAANQKACAlAADVCgAgJgAA1goAICgAANgKACApAADZCgAgKgAA2goAIDAAAP0MACCIBAEAzwcAIYsEQADSBwAhngRAANIHACGfBAEAzwcAIaAEAQDPBwAhqgQBANEHACHmBAAAxgrmBCP_BAAAxQqoBSOmBSAA0AcAIagFAQDRBwAhHQQAAMcKACAFAADICgAgBgAAyQoAIAcAAMoKACALAADMCgAgEAAAzgoAIBMAANMKACAbAADLCgAgHAAAzQoAIB0AAM8KACAhAADQCgAgIgAA0QoAICMAANIKACAkAADUCgAgJQAA1QoAICYAANYKACAoAADYCgAgKQAA2QoAICoAANoKACCIBAEAzwcAIYsEQADSBwAhngRAANIHACGfBAEAzwcAIaAEAQDPBwAhqgQBANEHACHmBAAAxgrmBCP_BAAAxQqoBSOmBSAA0AcAIagFAQDRBwAhAwAAABgAIDcAAPgMACA4AACADQAgFgAAABgAIAgAAMoJACALAADLCQAgEgAAzAkAIBMAAM0JACAaAADPCQAgMAAAgA0AIIgEAQDPBwAhngRAANIHACGhBAEAzwcAIaMEAQDPBwAhgAUBAM8HACGBBQEAzwcAIYIFCADbCAAhgwUBAM8HACGEBYAAAAABhQWAAAAAAYYFAQDPBwAhhwUgANAHACGIBQIA3gcAIYkFIADQBwAhigWAAAAAARQIAADKCQAgCwAAywkAIBIAAMwJACATAADNCQAgGgAAzwkAIIgEAQDPBwAhngRAANIHACGhBAEAzwcAIaMEAQDPBwAhgAUBAM8HACGBBQEAzwcAIYIFCADbCAAhgwUBAM8HACGEBYAAAAABhQWAAAAAAYYFAQDPBwAhhwUgANAHACGIBQIA3gcAIYkFIADQBwAhigWAAAAAAR0EAACZDAAgBQAAmgwAIAYAAJsMACAHAACcDAAgCwAAngwAIBAAAKAMACATAAClDAAgGwAAnQwAIBwAAJ8MACAdAAChDAAgIQAAogwAICIAAKMMACAjAACkDAAgJAAApgwAICUAAKcMACAmAACoDAAgJwAAqQwAICgAAKoMACApAACrDAAgiAQBAAAAAYsEQAAAAAGeBEAAAAABnwQBAAAAAaAEAQAAAAGqBAEAAAAB5gQAAADmBAP_BAAAAKgFA6YFIAAAAAGoBQEAAAABAgAAAAEAIDcAAIENACAJCgAAugkAIAwAALsJACCIBAEAAAABngRAAAAAAdMEAQAAAAHqBAEAAAAB8wQBAAAAAfwEAQAAAAH9BAEAAAABAgAAACwAIDcAAIMNACADAAAAHgAgNwAAgQ0AIDgAAIcNACAfAAAAHgAgBAAAxwoAIAUAAMgKACAGAADJCgAgBwAAygoAIAsAAMwKACAQAADOCgAgEwAA0woAIBsAAMsKACAcAADNCgAgHQAAzwoAICEAANAKACAiAADRCgAgIwAA0goAICQAANQKACAlAADVCgAgJgAA1goAICcAANcKACAoAADYCgAgKQAA2QoAIDAAAIcNACCIBAEAzwcAIYsEQADSBwAhngRAANIHACGfBAEAzwcAIaAEAQDPBwAhqgQBANEHACHmBAAAxgrmBCP_BAAAxQqoBSOmBSAA0AcAIagFAQDRBwAhHQQAAMcKACAFAADICgAgBgAAyQoAIAcAAMoKACALAADMCgAgEAAAzgoAIBMAANMKACAbAADLCgAgHAAAzQoAIB0AAM8KACAhAADQCgAgIgAA0QoAICMAANIKACAkAADUCgAgJQAA1QoAICYAANYKACAnAADXCgAgKAAA2AoAICkAANkKACCIBAEAzwcAIYsEQADSBwAhngRAANIHACGfBAEAzwcAIaAEAQDPBwAhqgQBANEHACHmBAAAxgrmBCP_BAAAxQqoBSOmBSAA0AcAIagFAQDRBwAhAwAAACoAIDcAAIMNACA4AACKDQAgCwAAACoAIAoAAKsJACAMAACsCQAgMAAAig0AIIgEAQDPBwAhngRAANIHACHTBAEAzwcAIeoEAQDPBwAh8wQBAM8HACH8BAEA0QcAIf0EAQDRBwAhCQoAAKsJACAMAACsCQAgiAQBAM8HACGeBEAA0gcAIdMEAQDPBwAh6gQBAM8HACHzBAEAzwcAIfwEAQDRBwAh_QQBANEHACEdBAAAmQwAIAUAAJoMACAGAACbDAAgBwAAnAwAIAsAAJ4MACAQAACgDAAgEwAApQwAIBsAAJ0MACAcAACfDAAgHQAAoQwAICEAAKIMACAiAACjDAAgIwAApAwAICQAAKYMACAlAACnDAAgJgAAqAwAICcAAKkMACApAACrDAAgKgAArAwAIIgEAQAAAAGLBEAAAAABngRAAAAAAZ8EAQAAAAGgBAEAAAABqgQBAAAAAeYEAAAA5gQD_wQAAACoBQOmBSAAAAABqAUBAAAAAQIAAAABACA3AACLDQAgFAgAAJgKACALAACZCgAgEgAAmgoAIBMAAJsKACAXAACcCgAgiAQBAAAAAZ4EQAAAAAGhBAEAAAABowQBAAAAAYAFAQAAAAGBBQEAAAABggUIAAAAAYMFAQAAAAGEBYAAAAABhQWAAAAAAYYFAQAAAAGHBSAAAAABiAUCAAAAAYkFIAAAAAGKBYAAAAABAgAAAIQCACA3AACNDQAgBIgEAQAAAAGeBEAAAAAB4gQBAAAAAeoEAQAAAAEDAAAAHgAgNwAAiw0AIDgAAJINACAfAAAAHgAgBAAAxwoAIAUAAMgKACAGAADJCgAgBwAAygoAIAsAAMwKACAQAADOCgAgEwAA0woAIBsAAMsKACAcAADNCgAgHQAAzwoAICEAANAKACAiAADRCgAgIwAA0goAICQAANQKACAlAADVCgAgJgAA1goAICcAANcKACApAADZCgAgKgAA2goAIDAAAJINACCIBAEAzwcAIYsEQADSBwAhngRAANIHACGfBAEAzwcAIaAEAQDPBwAhqgQBANEHACHmBAAAxgrmBCP_BAAAxQqoBSOmBSAA0AcAIagFAQDRBwAhHQQAAMcKACAFAADICgAgBgAAyQoAIAcAAMoKACALAADMCgAgEAAAzgoAIBMAANMKACAbAADLCgAgHAAAzQoAIB0AAM8KACAhAADQCgAgIgAA0QoAICMAANIKACAkAADUCgAgJQAA1QoAICYAANYKACAnAADXCgAgKQAA2QoAICoAANoKACCIBAEAzwcAIYsEQADSBwAhngRAANIHACGfBAEAzwcAIaAEAQDPBwAhqgQBANEHACHmBAAAxgrmBCP_BAAAxQqoBSOmBSAA0AcAIagFAQDRBwAhAwAAABgAIDcAAI0NACA4AACVDQAgFgAAABgAIAgAAMoJACALAADLCQAgEgAAzAkAIBMAAM0JACAXAADOCQAgMAAAlQ0AIIgEAQDPBwAhngRAANIHACGhBAEAzwcAIaMEAQDPBwAhgAUBAM8HACGBBQEAzwcAIYIFCADbCAAhgwUBAM8HACGEBYAAAAABhQWAAAAAAYYFAQDPBwAhhwUgANAHACGIBQIA3gcAIYkFIADQBwAhigWAAAAAARQIAADKCQAgCwAAywkAIBIAAMwJACATAADNCQAgFwAAzgkAIIgEAQDPBwAhngRAANIHACGhBAEAzwcAIaMEAQDPBwAhgAUBAM8HACGBBQEAzwcAIYIFCADbCAAhgwUBAM8HACGEBYAAAAABhQWAAAAAAYYFAQDPBwAhhwUgANAHACGIBQIA3gcAIYkFIADQBwAhigWAAAAAAR0EAACZDAAgBQAAmgwAIAYAAJsMACAHAACcDAAgCwAAngwAIBAAAKAMACATAAClDAAgGwAAnQwAIBwAAJ8MACAdAAChDAAgIQAAogwAICIAAKMMACAjAACkDAAgJAAApgwAICUAAKcMACAmAACoDAAgJwAAqQwAICgAAKoMACAqAACsDAAgiAQBAAAAAYsEQAAAAAGeBEAAAAABnwQBAAAAAaAEAQAAAAGqBAEAAAAB5gQAAADmBAP_BAAAAKgFA6YFIAAAAAGoBQEAAAABAgAAAAEAIDcAAJYNACAICgAAngkAIBUAAJ8JACCIBAEAAAABngRAAAAAAa4EAQAAAAHTBAEAAAAB4gQBAAAAAeoEAQAAAAECAAAANQAgNwAAmA0AIAMAAAAeACA3AACWDQAgOAAAnA0AIB8AAAAeACAEAADHCgAgBQAAyAoAIAYAAMkKACAHAADKCgAgCwAAzAoAIBAAAM4KACATAADTCgAgGwAAywoAIBwAAM0KACAdAADPCgAgIQAA0AoAICIAANEKACAjAADSCgAgJAAA1AoAICUAANUKACAmAADWCgAgJwAA1woAICgAANgKACAqAADaCgAgMAAAnA0AIIgEAQDPBwAhiwRAANIHACGeBEAA0gcAIZ8EAQDPBwAhoAQBAM8HACGqBAEA0QcAIeYEAADGCuYEI_8EAADFCqgFI6YFIADQBwAhqAUBANEHACEdBAAAxwoAIAUAAMgKACAGAADJCgAgBwAAygoAIAsAAMwKACAQAADOCgAgEwAA0woAIBsAAMsKACAcAADNCgAgHQAAzwoAICEAANAKACAiAADRCgAgIwAA0goAICQAANQKACAlAADVCgAgJgAA1goAICcAANcKACAoAADYCgAgKgAA2goAIIgEAQDPBwAhiwRAANIHACGeBEAA0gcAIZ8EAQDPBwAhoAQBAM8HACGqBAEA0QcAIeYEAADGCuYEI_8EAADFCqgFI6YFIADQBwAhqAUBANEHACEDAAAAMwAgNwAAmA0AIDgAAJ8NACAKAAAAMwAgCgAAjwkAIBUAAJAJACAwAACfDQAgiAQBAM8HACGeBEAA0gcAIa4EAQDPBwAh0wQBAM8HACHiBAEAzwcAIeoEAQDPBwAhCAoAAI8JACAVAACQCQAgiAQBAM8HACGeBEAA0gcAIa4EAQDPBwAh0wQBAM8HACHiBAEAzwcAIeoEAQDPBwAhHQQAAJkMACAFAACaDAAgBgAAmwwAIAcAAJwMACALAACeDAAgEAAAoAwAIBMAAKUMACAbAACdDAAgHQAAoQwAICEAAKIMACAiAACjDAAgIwAApAwAICQAAKYMACAlAACnDAAgJgAAqAwAICcAAKkMACAoAACqDAAgKQAAqwwAICoAAKwMACCIBAEAAAABiwRAAAAAAZ4EQAAAAAGfBAEAAAABoAQBAAAAAaoEAQAAAAHmBAAAAOYEA_8EAAAAqAUDpgUgAAAAAagFAQAAAAECAAAAAQAgNwAAoA0AIBQIAACYCgAgCwAAmQoAIBMAAJsKACAXAACcCgAgGgAAnQoAIIgEAQAAAAGeBEAAAAABoQQBAAAAAaMEAQAAAAGABQEAAAABgQUBAAAAAYIFCAAAAAGDBQEAAAABhAWAAAAAAYUFgAAAAAGGBQEAAAABhwUgAAAAAYgFAgAAAAGJBSAAAAABigWAAAAAAQIAAACEAgAgNwAAog0AIAaIBAEAAAABngRAAAAAAdQEAQAAAAHwBAEAAAAB8QQIAAAAAfIEAQAAAAEDAAAAHgAgNwAAoA0AIDgAAKcNACAfAAAAHgAgBAAAxwoAIAUAAMgKACAGAADJCgAgBwAAygoAIAsAAMwKACAQAADOCgAgEwAA0woAIBsAAMsKACAdAADPCgAgIQAA0AoAICIAANEKACAjAADSCgAgJAAA1AoAICUAANUKACAmAADWCgAgJwAA1woAICgAANgKACApAADZCgAgKgAA2goAIDAAAKcNACCIBAEAzwcAIYsEQADSBwAhngRAANIHACGfBAEAzwcAIaAEAQDPBwAhqgQBANEHACHmBAAAxgrmBCP_BAAAxQqoBSOmBSAA0AcAIagFAQDRBwAhHQQAAMcKACAFAADICgAgBgAAyQoAIAcAAMoKACALAADMCgAgEAAAzgoAIBMAANMKACAbAADLCgAgHQAAzwoAICEAANAKACAiAADRCgAgIwAA0goAICQAANQKACAlAADVCgAgJgAA1goAICcAANcKACAoAADYCgAgKQAA2QoAICoAANoKACCIBAEAzwcAIYsEQADSBwAhngRAANIHACGfBAEAzwcAIaAEAQDPBwAhqgQBANEHACHmBAAAxgrmBCP_BAAAxQqoBSOmBSAA0AcAIagFAQDRBwAhAwAAABgAIDcAAKINACA4AACqDQAgFgAAABgAIAgAAMoJACALAADLCQAgEwAAzQkAIBcAAM4JACAaAADPCQAgMAAAqg0AIIgEAQDPBwAhngRAANIHACGhBAEAzwcAIaMEAQDPBwAhgAUBAM8HACGBBQEAzwcAIYIFCADbCAAhgwUBAM8HACGEBYAAAAABhQWAAAAAAYYFAQDPBwAhhwUgANAHACGIBQIA3gcAIYkFIADQBwAhigWAAAAAARQIAADKCQAgCwAAywkAIBMAAM0JACAXAADOCQAgGgAAzwkAIIgEAQDPBwAhngRAANIHACGhBAEAzwcAIaMEAQDPBwAhgAUBAM8HACGBBQEAzwcAIYIFCADbCAAhgwUBAM8HACGEBYAAAAABhQWAAAAAAYYFAQDPBwAhhwUgANAHACGIBQIA3gcAIYkFIADQBwAhigWAAAAAAR0EAACZDAAgBQAAmgwAIAYAAJsMACAHAACcDAAgCwAAngwAIBAAAKAMACATAAClDAAgGwAAnQwAIBwAAJ8MACAhAACiDAAgIgAAowwAICMAAKQMACAkAACmDAAgJQAApwwAICYAAKgMACAnAACpDAAgKAAAqgwAICkAAKsMACAqAACsDAAgiAQBAAAAAYsEQAAAAAGeBEAAAAABnwQBAAAAAaAEAQAAAAGqBAEAAAAB5gQAAADmBAP_BAAAAKgFA6YFIAAAAAGoBQEAAAABAgAAAAEAIDcAAKsNACAdBAAAmQwAIAUAAJoMACAGAACbDAAgBwAAnAwAIAsAAJ4MACATAAClDAAgGwAAnQwAIBwAAJ8MACAdAAChDAAgIQAAogwAICIAAKMMACAjAACkDAAgJAAApgwAICUAAKcMACAmAACoDAAgJwAAqQwAICgAAKoMACApAACrDAAgKgAArAwAIIgEAQAAAAGLBEAAAAABngRAAAAAAZ8EAQAAAAGgBAEAAAABqgQBAAAAAeYEAAAA5gQD_wQAAACoBQOmBSAAAAABqAUBAAAAAQIAAAABACA3AACtDQAgDAoAAIIJACAMAACDCQAgiAQBAAAAAZ4EQAAAAAGuBAEAAAABrwQBAAAAAdMEAQAAAAHzBAEAAAAB9QQAAAD1BAL3BAAAAPcEA_gEQAAAAAH5BAgAAAABAgAAABwAIDcAAK8NACADAAAAHgAgNwAAqw0AIDgAALMNACAfAAAAHgAgBAAAxwoAIAUAAMgKACAGAADJCgAgBwAAygoAIAsAAMwKACAQAADOCgAgEwAA0woAIBsAAMsKACAcAADNCgAgIQAA0AoAICIAANEKACAjAADSCgAgJAAA1AoAICUAANUKACAmAADWCgAgJwAA1woAICgAANgKACApAADZCgAgKgAA2goAIDAAALMNACCIBAEAzwcAIYsEQADSBwAhngRAANIHACGfBAEAzwcAIaAEAQDPBwAhqgQBANEHACHmBAAAxgrmBCP_BAAAxQqoBSOmBSAA0AcAIagFAQDRBwAhHQQAAMcKACAFAADICgAgBgAAyQoAIAcAAMoKACALAADMCgAgEAAAzgoAIBMAANMKACAbAADLCgAgHAAAzQoAICEAANAKACAiAADRCgAgIwAA0goAICQAANQKACAlAADVCgAgJgAA1goAICcAANcKACAoAADYCgAgKQAA2QoAICoAANoKACCIBAEAzwcAIYsEQADSBwAhngRAANIHACGfBAEAzwcAIaAEAQDPBwAhqgQBANEHACHmBAAAxgrmBCP_BAAAxQqoBSOmBSAA0AcAIagFAQDRBwAhAwAAAB4AIDcAAK0NACA4AAC2DQAgHwAAAB4AIAQAAMcKACAFAADICgAgBgAAyQoAIAcAAMoKACALAADMCgAgEwAA0woAIBsAAMsKACAcAADNCgAgHQAAzwoAICEAANAKACAiAADRCgAgIwAA0goAICQAANQKACAlAADVCgAgJgAA1goAICcAANcKACAoAADYCgAgKQAA2QoAICoAANoKACAwAAC2DQAgiAQBAM8HACGLBEAA0gcAIZ4EQADSBwAhnwQBAM8HACGgBAEAzwcAIaoEAQDRBwAh5gQAAMYK5gQj_wQAAMUKqAUjpgUgANAHACGoBQEA0QcAIR0EAADHCgAgBQAAyAoAIAYAAMkKACAHAADKCgAgCwAAzAoAIBMAANMKACAbAADLCgAgHAAAzQoAIB0AAM8KACAhAADQCgAgIgAA0QoAICMAANIKACAkAADUCgAgJQAA1QoAICYAANYKACAnAADXCgAgKAAA2AoAICkAANkKACAqAADaCgAgiAQBAM8HACGLBEAA0gcAIZ4EQADSBwAhnwQBAM8HACGgBAEAzwcAIaoEAQDRBwAh5gQAAMYK5gQj_wQAAMUKqAUjpgUgANAHACGoBQEA0QcAIQMAAAAaACA3AACvDQAgOAAAuQ0AIA4AAAAaACAKAADzCAAgDAAA9AgAIDAAALkNACCIBAEAzwcAIZ4EQADSBwAhrgQBAM8HACGvBAEA0QcAIdMEAQDPBwAh8wQBANEHACH1BAAA8Qj1BCL3BAAA8gj3BCP4BEAA0gcAIfkECADbCAAhDAoAAPMIACAMAAD0CAAgiAQBAM8HACGeBEAA0gcAIa4EAQDPBwAhrwQBANEHACHTBAEAzwcAIfMEAQDRBwAh9QQAAPEI9QQi9wQAAPII9wQj-ARAANIHACH5BAgA2wgAIRQIAACYCgAgEgAAmgoAIBMAAJsKACAXAACcCgAgGgAAnQoAIIgEAQAAAAGeBEAAAAABoQQBAAAAAaMEAQAAAAGABQEAAAABgQUBAAAAAYIFCAAAAAGDBQEAAAABhAWAAAAAAYUFgAAAAAGGBQEAAAABhwUgAAAAAYgFAgAAAAGJBSAAAAABigWAAAAAAQIAAACEAgAgNwAAug0AIB0EAACZDAAgBQAAmgwAIAYAAJsMACAHAACcDAAgEAAAoAwAIBMAAKUMACAbAACdDAAgHAAAnwwAIB0AAKEMACAhAACiDAAgIgAAowwAICMAAKQMACAkAACmDAAgJQAApwwAICYAAKgMACAnAACpDAAgKAAAqgwAICkAAKsMACAqAACsDAAgiAQBAAAAAYsEQAAAAAGeBEAAAAABnwQBAAAAAaAEAQAAAAGqBAEAAAAB5gQAAADmBAP_BAAAAKgFA6YFIAAAAAGoBQEAAAABAgAAAAEAIDcAALwNACADAAAAGAAgNwAAug0AIDgAAMANACAWAAAAGAAgCAAAygkAIBIAAMwJACATAADNCQAgFwAAzgkAIBoAAM8JACAwAADADQAgiAQBAM8HACGeBEAA0gcAIaEEAQDPBwAhowQBAM8HACGABQEAzwcAIYEFAQDPBwAhggUIANsIACGDBQEAzwcAIYQFgAAAAAGFBYAAAAABhgUBAM8HACGHBSAA0AcAIYgFAgDeBwAhiQUgANAHACGKBYAAAAABFAgAAMoJACASAADMCQAgEwAAzQkAIBcAAM4JACAaAADPCQAgiAQBAM8HACGeBEAA0gcAIaEEAQDPBwAhowQBAM8HACGABQEAzwcAIYEFAQDPBwAhggUIANsIACGDBQEAzwcAIYQFgAAAAAGFBYAAAAABhgUBAM8HACGHBSAA0AcAIYgFAgDeBwAhiQUgANAHACGKBYAAAAABAwAAAB4AIDcAALwNACA4AADDDQAgHwAAAB4AIAQAAMcKACAFAADICgAgBgAAyQoAIAcAAMoKACAQAADOCgAgEwAA0woAIBsAAMsKACAcAADNCgAgHQAAzwoAICEAANAKACAiAADRCgAgIwAA0goAICQAANQKACAlAADVCgAgJgAA1goAICcAANcKACAoAADYCgAgKQAA2QoAICoAANoKACAwAADDDQAgiAQBAM8HACGLBEAA0gcAIZ4EQADSBwAhnwQBAM8HACGgBAEAzwcAIaoEAQDRBwAh5gQAAMYK5gQj_wQAAMUKqAUjpgUgANAHACGoBQEA0QcAIR0EAADHCgAgBQAAyAoAIAYAAMkKACAHAADKCgAgEAAAzgoAIBMAANMKACAbAADLCgAgHAAAzQoAIB0AAM8KACAhAADQCgAgIgAA0QoAICMAANIKACAkAADUCgAgJQAA1QoAICYAANYKACAnAADXCgAgKAAA2AoAICkAANkKACAqAADaCgAgiAQBAM8HACGLBEAA0gcAIZ4EQADSBwAhnwQBAM8HACGgBAEAzwcAIaoEAQDRBwAh5gQAAMYK5gQj_wQAAMUKqAUjpgUgANAHACGoBQEA0QcAIR0EAACZDAAgBQAAmgwAIAYAAJsMACAHAACcDAAgCwAAngwAIBAAAKAMACATAAClDAAgGwAAnQwAIBwAAJ8MACAdAAChDAAgIgAAowwAICMAAKQMACAkAACmDAAgJQAApwwAICYAAKgMACAnAACpDAAgKAAAqgwAICkAAKsMACAqAACsDAAgiAQBAAAAAYsEQAAAAAGeBEAAAAABnwQBAAAAAaAEAQAAAAGqBAEAAAAB5gQAAADmBAP_BAAAAKgFA6YFIAAAAAGoBQEAAAABAgAAAAEAIDcAAMQNACAEiAQBAAAAAZ4EQAAAAAHgBAEAAAAB6gQBAAAAAQMAAAAeACA3AADEDQAgOAAAyQ0AIB8AAAAeACAEAADHCgAgBQAAyAoAIAYAAMkKACAHAADKCgAgCwAAzAoAIBAAAM4KACATAADTCgAgGwAAywoAIBwAAM0KACAdAADPCgAgIgAA0QoAICMAANIKACAkAADUCgAgJQAA1QoAICYAANYKACAnAADXCgAgKAAA2AoAICkAANkKACAqAADaCgAgMAAAyQ0AIIgEAQDPBwAhiwRAANIHACGeBEAA0gcAIZ8EAQDPBwAhoAQBAM8HACGqBAEA0QcAIeYEAADGCuYEI_8EAADFCqgFI6YFIADQBwAhqAUBANEHACEdBAAAxwoAIAUAAMgKACAGAADJCgAgBwAAygoAIAsAAMwKACAQAADOCgAgEwAA0woAIBsAAMsKACAcAADNCgAgHQAAzwoAICIAANEKACAjAADSCgAgJAAA1AoAICUAANUKACAmAADWCgAgJwAA1woAICgAANgKACApAADZCgAgKgAA2goAIIgEAQDPBwAhiwRAANIHACGeBEAA0gcAIZ8EAQDPBwAhoAQBAM8HACGqBAEA0QcAIeYEAADGCuYEI_8EAADFCqgFI6YFIADQBwAhqAUBANEHACEdBAAAmQwAIAUAAJoMACAGAACbDAAgBwAAnAwAIAsAAJ4MACAQAACgDAAgEwAApQwAIBsAAJ0MACAcAACfDAAgHQAAoQwAICEAAKIMACAjAACkDAAgJAAApgwAICUAAKcMACAmAACoDAAgJwAAqQwAICgAAKoMACApAACrDAAgKgAArAwAIIgEAQAAAAGLBEAAAAABngRAAAAAAZ8EAQAAAAGgBAEAAAABqgQBAAAAAeYEAAAA5gQD_wQAAACoBQOmBSAAAAABqAUBAAAAAQIAAAABACA3AADKDQAgBxUAANQIACCIBAEAAAABngRAAAAAAa4EAQAAAAGvBAEAAAAB4gQBAAAAAesEIAAAAAECAAAASAAgNwAAzA0AIAMAAAAeACA3AADKDQAgOAAA0A0AIB8AAAAeACAEAADHCgAgBQAAyAoAIAYAAMkKACAHAADKCgAgCwAAzAoAIBAAAM4KACATAADTCgAgGwAAywoAIBwAAM0KACAdAADPCgAgIQAA0AoAICMAANIKACAkAADUCgAgJQAA1QoAICYAANYKACAnAADXCgAgKAAA2AoAICkAANkKACAqAADaCgAgMAAA0A0AIIgEAQDPBwAhiwRAANIHACGeBEAA0gcAIZ8EAQDPBwAhoAQBAM8HACGqBAEA0QcAIeYEAADGCuYEI_8EAADFCqgFI6YFIADQBwAhqAUBANEHACEdBAAAxwoAIAUAAMgKACAGAADJCgAgBwAAygoAIAsAAMwKACAQAADOCgAgEwAA0woAIBsAAMsKACAcAADNCgAgHQAAzwoAICEAANAKACAjAADSCgAgJAAA1AoAICUAANUKACAmAADWCgAgJwAA1woAICgAANgKACApAADZCgAgKgAA2goAIIgEAQDPBwAhiwRAANIHACGeBEAA0gcAIZ8EAQDPBwAhoAQBAM8HACGqBAEA0QcAIeYEAADGCuYEI_8EAADFCqgFI6YFIADQBwAhqAUBANEHACEDAAAARgAgNwAAzA0AIDgAANMNACAJAAAARgAgFQAAxggAIDAAANMNACCIBAEAzwcAIZ4EQADSBwAhrgQBAM8HACGvBAEAzwcAIeIEAQDPBwAh6wQgANAHACEHFQAAxggAIIgEAQDPBwAhngRAANIHACGuBAEAzwcAIa8EAQDPBwAh4gQBAM8HACHrBCAA0AcAIR0EAACZDAAgBQAAmgwAIAYAAJsMACAHAACcDAAgCwAAngwAIBAAAKAMACATAAClDAAgGwAAnQwAIBwAAJ8MACAdAAChDAAgIQAAogwAICIAAKMMACAkAACmDAAgJQAApwwAICYAAKgMACAnAACpDAAgKAAAqgwAICkAAKsMACAqAACsDAAgiAQBAAAAAYsEQAAAAAGeBEAAAAABnwQBAAAAAaAEAQAAAAGqBAEAAAAB5gQAAADmBAP_BAAAAKgFA6YFIAAAAAGoBQEAAAABAgAAAAEAIDcAANQNACAEiAQBAAAAAZ4EQAAAAAHgBAEAAAAB4QQBAAAAAQMAAAAeACA3AADUDQAgOAAA2Q0AIB8AAAAeACAEAADHCgAgBQAAyAoAIAYAAMkKACAHAADKCgAgCwAAzAoAIBAAAM4KACATAADTCgAgGwAAywoAIBwAAM0KACAdAADPCgAgIQAA0AoAICIAANEKACAkAADUCgAgJQAA1QoAICYAANYKACAnAADXCgAgKAAA2AoAICkAANkKACAqAADaCgAgMAAA2Q0AIIgEAQDPBwAhiwRAANIHACGeBEAA0gcAIZ8EAQDPBwAhoAQBAM8HACGqBAEA0QcAIeYEAADGCuYEI_8EAADFCqgFI6YFIADQBwAhqAUBANEHACEdBAAAxwoAIAUAAMgKACAGAADJCgAgBwAAygoAIAsAAMwKACAQAADOCgAgEwAA0woAIBsAAMsKACAcAADNCgAgHQAAzwoAICEAANAKACAiAADRCgAgJAAA1AoAICUAANUKACAmAADWCgAgJwAA1woAICgAANgKACApAADZCgAgKgAA2goAIIgEAQDPBwAhiwRAANIHACGeBEAA0gcAIZ8EAQDPBwAhoAQBAM8HACGqBAEA0QcAIeYEAADGCuYEI_8EAADFCqgFI6YFIADQBwAhqAUBANEHACEdBAAAmQwAIAUAAJoMACAGAACbDAAgBwAAnAwAIAsAAJ4MACAQAACgDAAgEwAApQwAIBsAAJ0MACAcAACfDAAgHQAAoQwAICEAAKIMACAiAACjDAAgIwAApAwAICUAAKcMACAmAACoDAAgJwAAqQwAICgAAKoMACApAACrDAAgKgAArAwAIIgEAQAAAAGLBEAAAAABngRAAAAAAZ8EAQAAAAGgBAEAAAABqgQBAAAAAeYEAAAA5gQD_wQAAACoBQOmBSAAAAABqAUBAAAAAQIAAAABACA3AADaDQAgCxUAALoIACCIBAEAAAABngRAAAAAAbIEAQAAAAHiBAEAAAAB4wQBAAAAAeQEAQAAAAHmBAAAAOYEAucEAQAAAAHoBAEAAAAB6QQgAAAAAQIAAABSACA3AADcDQAgAwAAAB4AIDcAANoNACA4AADgDQAgHwAAAB4AIAQAAMcKACAFAADICgAgBgAAyQoAIAcAAMoKACALAADMCgAgEAAAzgoAIBMAANMKACAbAADLCgAgHAAAzQoAIB0AAM8KACAhAADQCgAgIgAA0QoAICMAANIKACAlAADVCgAgJgAA1goAICcAANcKACAoAADYCgAgKQAA2QoAICoAANoKACAwAADgDQAgiAQBAM8HACGLBEAA0gcAIZ4EQADSBwAhnwQBAM8HACGgBAEAzwcAIaoEAQDRBwAh5gQAAMYK5gQj_wQAAMUKqAUjpgUgANAHACGoBQEA0QcAIR0EAADHCgAgBQAAyAoAIAYAAMkKACAHAADKCgAgCwAAzAoAIBAAAM4KACATAADTCgAgGwAAywoAIBwAAM0KACAdAADPCgAgIQAA0AoAICIAANEKACAjAADSCgAgJQAA1QoAICYAANYKACAnAADXCgAgKAAA2AoAICkAANkKACAqAADaCgAgiAQBAM8HACGLBEAA0gcAIZ4EQADSBwAhnwQBAM8HACGgBAEAzwcAIaoEAQDRBwAh5gQAAMYK5gQj_wQAAMUKqAUjpgUgANAHACGoBQEA0QcAIQMAAABQACA3AADcDQAgOAAA4w0AIA0AAABQACAVAACsCAAgMAAA4w0AIIgEAQDPBwAhngRAANIHACGyBAEAzwcAIeIEAQDPBwAh4wQBAM8HACHkBAEAzwcAIeYEAACrCOYEIucEAQDPBwAh6AQBAM8HACHpBCAA0AcAIQsVAACsCAAgiAQBAM8HACGeBEAA0gcAIbIEAQDPBwAh4gQBAM8HACHjBAEAzwcAIeQEAQDPBwAh5gQAAKsI5gQi5wQBAM8HACHoBAEAzwcAIekEIADQBwAhHQQAAJkMACAFAACaDAAgBgAAmwwAIAcAAJwMACALAACeDAAgEAAAoAwAIBsAAJ0MACAcAACfDAAgHQAAoQwAICEAAKIMACAiAACjDAAgIwAApAwAICQAAKYMACAlAACnDAAgJgAAqAwAICcAAKkMACAoAACqDAAgKQAAqwwAICoAAKwMACCIBAEAAAABiwRAAAAAAZ4EQAAAAAGfBAEAAAABoAQBAAAAAaoEAQAAAAHmBAAAAOYEA_8EAAAAqAUDpgUgAAAAAagFAQAAAAECAAAAAQAgNwAA5A0AIBQIAACYCgAgCwAAmQoAIBIAAJoKACAXAACcCgAgGgAAnQoAIIgEAQAAAAGeBEAAAAABoQQBAAAAAaMEAQAAAAGABQEAAAABgQUBAAAAAYIFCAAAAAGDBQEAAAABhAWAAAAAAYUFgAAAAAGGBQEAAAABhwUgAAAAAYgFAgAAAAGJBSAAAAABigWAAAAAAQIAAACEAgAgNwAA5g0AIAMAAAAeACA3AADkDQAgOAAA6g0AIB8AAAAeACAEAADHCgAgBQAAyAoAIAYAAMkKACAHAADKCgAgCwAAzAoAIBAAAM4KACAbAADLCgAgHAAAzQoAIB0AAM8KACAhAADQCgAgIgAA0QoAICMAANIKACAkAADUCgAgJQAA1QoAICYAANYKACAnAADXCgAgKAAA2AoAICkAANkKACAqAADaCgAgMAAA6g0AIIgEAQDPBwAhiwRAANIHACGeBEAA0gcAIZ8EAQDPBwAhoAQBAM8HACGqBAEA0QcAIeYEAADGCuYEI_8EAADFCqgFI6YFIADQBwAhqAUBANEHACEdBAAAxwoAIAUAAMgKACAGAADJCgAgBwAAygoAIAsAAMwKACAQAADOCgAgGwAAywoAIBwAAM0KACAdAADPCgAgIQAA0AoAICIAANEKACAjAADSCgAgJAAA1AoAICUAANUKACAmAADWCgAgJwAA1woAICgAANgKACApAADZCgAgKgAA2goAIIgEAQDPBwAhiwRAANIHACGeBEAA0gcAIZ8EAQDPBwAhoAQBAM8HACGqBAEA0QcAIeYEAADGCuYEI_8EAADFCqgFI6YFIADQBwAhqAUBANEHACEDAAAAGAAgNwAA5g0AIDgAAO0NACAWAAAAGAAgCAAAygkAIAsAAMsJACASAADMCQAgFwAAzgkAIBoAAM8JACAwAADtDQAgiAQBAM8HACGeBEAA0gcAIaEEAQDPBwAhowQBAM8HACGABQEAzwcAIYEFAQDPBwAhggUIANsIACGDBQEAzwcAIYQFgAAAAAGFBYAAAAABhgUBAM8HACGHBSAA0AcAIYgFAgDeBwAhiQUgANAHACGKBYAAAAABFAgAAMoJACALAADLCQAgEgAAzAkAIBcAAM4JACAaAADPCQAgiAQBAM8HACGeBEAA0gcAIaEEAQDPBwAhowQBAM8HACGABQEAzwcAIYEFAQDPBwAhggUIANsIACGDBQEAzwcAIYQFgAAAAAGFBYAAAAABhgUBAM8HACGHBSAA0AcAIYgFAgDeBwAhiQUgANAHACGKBYAAAAABDIgEAQAAAAGLBEAAAAABngRAAAAAAa4EAQAAAAGvBAEAAAABsAQAAAC8BAK8BEAAAAABvQRAAAAAAb4EAgAAAAG_BCAAAAABwAQgAAAAAcEEAQAAAAEOiAQBAAAAAYsEQAAAAAGdBAAAAMUEAp4EQAAAAAGuBAEAAAABwgQBAAAAAcMEAgAAAAHFBCAAAAABxgQgAAAAAccEAACOCAAgyAQAAI8IACDJBEAAAAABygQBAAAAAcsEAQAAAAECAAAA2QQAIDcAAO8NACADAAAA4QQAIDcAAO8NACA4AADzDQAgEAAAAOEEACAwAADzDQAgiAQBAM8HACGLBEAA0gcAIZ0EAAD-B8UEIp4EQADSBwAhrgQBAM8HACHCBAEAzwcAIcMEAgDeBwAhxQQgANAHACHGBCAA0AcAIccEAAD_BwAgyAQAAIAIACDJBEAA9QcAIcoEAQDRBwAhywQBANEHACEOiAQBAM8HACGLBEAA0gcAIZ0EAAD-B8UEIp4EQADSBwAhrgQBAM8HACHCBAEAzwcAIcMEAgDeBwAhxQQgANAHACHGBCAA0AcAIccEAAD_BwAgyAQAAIAIACDJBEAA9QcAIcoEAQDRBwAhywQBANEHACEdBAAAmQwAIAUAAJoMACAGAACbDAAgBwAAnAwAIAsAAJ4MACAQAACgDAAgEwAApQwAIBsAAJ0MACAcAACfDAAgHQAAoQwAICEAAKIMACAiAACjDAAgIwAApAwAICQAAKYMACAmAACoDAAgJwAAqQwAICgAAKoMACApAACrDAAgKgAArAwAIIgEAQAAAAGLBEAAAAABngRAAAAAAZ8EAQAAAAGgBAEAAAABqgQBAAAAAeYEAAAA5gQD_wQAAACoBQOmBSAAAAABqAUBAAAAAQIAAAABACA3AAD0DQAgAwAAAB4AIDcAAPQNACA4AAD4DQAgHwAAAB4AIAQAAMcKACAFAADICgAgBgAAyQoAIAcAAMoKACALAADMCgAgEAAAzgoAIBMAANMKACAbAADLCgAgHAAAzQoAIB0AAM8KACAhAADQCgAgIgAA0QoAICMAANIKACAkAADUCgAgJgAA1goAICcAANcKACAoAADYCgAgKQAA2QoAICoAANoKACAwAAD4DQAgiAQBAM8HACGLBEAA0gcAIZ4EQADSBwAhnwQBAM8HACGgBAEAzwcAIaoEAQDRBwAh5gQAAMYK5gQj_wQAAMUKqAUjpgUgANAHACGoBQEA0QcAIR0EAADHCgAgBQAAyAoAIAYAAMkKACAHAADKCgAgCwAAzAoAIBAAAM4KACATAADTCgAgGwAAywoAIBwAAM0KACAdAADPCgAgIQAA0AoAICIAANEKACAjAADSCgAgJAAA1AoAICYAANYKACAnAADXCgAgKAAA2AoAICkAANkKACAqAADaCgAgiAQBAM8HACGLBEAA0gcAIZ4EQADSBwAhnwQBAM8HACGgBAEAzwcAIaoEAQDRBwAh5gQAAMYK5gQj_wQAAMUKqAUjpgUgANAHACGoBQEA0QcAIR0EAACZDAAgBQAAmgwAIAYAAJsMACAHAACcDAAgCwAAngwAIBAAAKAMACATAAClDAAgGwAAnQwAIBwAAJ8MACAdAAChDAAgIQAAogwAICIAAKMMACAjAACkDAAgJAAApgwAICUAAKcMACAnAACpDAAgKAAAqgwAICkAAKsMACAqAACsDAAgiAQBAAAAAYsEQAAAAAGeBEAAAAABnwQBAAAAAaAEAQAAAAGqBAEAAAAB5gQAAADmBAP_BAAAAKgFA6YFIAAAAAGoBQEAAAABAgAAAAEAIDcAAPkNACADAAAAHgAgNwAA-Q0AIDgAAP0NACAfAAAAHgAgBAAAxwoAIAUAAMgKACAGAADJCgAgBwAAygoAIAsAAMwKACAQAADOCgAgEwAA0woAIBsAAMsKACAcAADNCgAgHQAAzwoAICEAANAKACAiAADRCgAgIwAA0goAICQAANQKACAlAADVCgAgJwAA1woAICgAANgKACApAADZCgAgKgAA2goAIDAAAP0NACCIBAEAzwcAIYsEQADSBwAhngRAANIHACGfBAEAzwcAIaAEAQDPBwAhqgQBANEHACHmBAAAxgrmBCP_BAAAxQqoBSOmBSAA0AcAIagFAQDRBwAhHQQAAMcKACAFAADICgAgBgAAyQoAIAcAAMoKACALAADMCgAgEAAAzgoAIBMAANMKACAbAADLCgAgHAAAzQoAIB0AAM8KACAhAADQCgAgIgAA0QoAICMAANIKACAkAADUCgAgJQAA1QoAICcAANcKACAoAADYCgAgKQAA2QoAICoAANoKACCIBAEAzwcAIYsEQADSBwAhngRAANIHACGfBAEAzwcAIaAEAQDPBwAhqgQBANEHACHmBAAAxgrmBCP_BAAAxQqoBSOmBSAA0AcAIagFAQDRBwAhFQQGAgUKAwYMBAcOBQtCCBBEChEAHBNZDBsSBhxDCR1FCiFJFCJPFSNTFyRaGCVeGiZiGydjDShkECllESpmDgEDAAEBAwABAQMAAQEDAAECAwABCgAHBwgTBgsXCBEAExIdCRMpDBctDRo2EAIJAAEKGQcECgAHDB8BECMKEQALAw0ACQ4AAQ8kAQEQJQACCgAHDgABBAoABwwAAREADxYxDgIUAA0VAAEBFjIABAoABxEAEhUAARk6EQIVAAEYABABGTsABgg8AAs9ABI-ABM_ABdAABpBAAMRABYVAAEgTRUCHgAUHwABASBOAAMRABkVAAEgVxgCHgAXHwABASBYAAEDAAEBAwABEgRnAAVoAAtqABBsABNxABtpABxrAB1tACFuACJvACNwACRyACVzACZ0ACd1ACh2ACl3ACp4AAAAAAMRACE9ACI-ACMAAAADEQAhPQAiPgAjAQMAAQEDAAEDEQAoPQApPgAqAAAAAxEAKD0AKT4AKgEDAAEBAwABAxEALz0AMD4AMQAAAAMRAC89ADA-ADEAAAADEQA3PQA4PgA5AAAAAxEANz0AOD4AOQEDAAEBAwABBREAPj0AQT4AQn8AP4ABAEAAAAAAAAURAD49AEE-AEJ_AD-AAQBAAQMAAQEDAAEDEQBHPQBIPgBJAAAAAxEARz0ASD4ASQAABREATj0AUT4AUn8AT4ABAFAAAAAAAAURAE49AFE-AFJ_AE-AAQBQAgMAAQoABwIDAAEKAAcDEQBXPQBYPgBZAAAAAxEAVz0AWD4AWQIKAAcMAAECCgAHDAABAxEAXj0AXz4AYAAAAAMRAF49AF8-AGACFAANFQABAhQADRUAAQMRAGU9AGY-AGcAAAADEQBlPQBmPgBnAgoABxUAAQIKAAcVAAEDEQBsPQBtPgBuAAAAAxEAbD0AbT4AbgIVAAEYABACFQABGAAQAxEAcz0AdD4AdQAAAAMRAHM9AHQ-AHUCCgAHDJQDAQIKAAcMmgMBBREAej0AfT4Afn8Ae4ABAHwAAAAAAAURAHo9AH0-AH5_AHuAAQB8Aw0ACQ4AAQ-sAwEDDQAJDgABD7IDAQURAIMBPQCGAT4AhwF_AIQBgAEAhQEAAAAAAAURAIMBPQCGAT4AhwF_AIQBgAEAhQECCQABCsQDBwIJAAEKygMHBREAjAE9AI8BPgCQAX8AjQGAAQCOAQAAAAAABREAjAE9AI8BPgCQAX8AjQGAAQCOAQEVAAEBFQABAxEAlQE9AJYBPgCXAQAAAAMRAJUBPQCWAT4AlwECHgAUHwABAh4AFB8AAQMRAJwBPQCdAT4AngEAAAADEQCcAT0AnQE-AJ4BARUAAQEVAAEDEQCjAT0ApAE-AKUBAAAAAxEAowE9AKQBPgClAQIeABcfAAECHgAXHwABAxEAqgE9AKsBPgCsAQAAAAMRAKoBPQCrAT4ArAECCgAHDgABAgoABw4AAQURALEBPQC0AT4AtQF_ALIBgAEAswEAAAAAAAURALEBPQC0AT4AtQF_ALIBgAEAswEAAAADEQC7AT0AvAE-AL0BAAAAAxEAuwE9ALwBPgC9AQIRAMEBhAPeBMABAYMDAL8BAYQD3wQAAAAFEQDFAT0AyAE-AMkBfwDGAYABAMcBAAAAAAAFEQDFAT0AyAE-AMkBfwDGAYABAMcBAYMDAL8BAYMDAL8BBREAzgE9ANEBPgDSAX8AzwGAAQDQAQAAAAAABREAzgE9ANEBPgDSAX8AzwGAAQDQAQAAAAMRANgBPQDZAT4A2gEAAAADEQDYAT0A2QE-ANoBAAAAAxEA4AE9AOEBPgDiAQAAAAMRAOABPQDhAT4A4gEBAwABAQMAAQMRAOcBPQDoAT4A6QEAAAADEQDnAT0A6AE-AOkBAAAABREA7wE9APIBPgDzAX8A8AGAAQDxAQAAAAAABREA7wE9APIBPgDzAX8A8AGAAQDxAQEDAAEBAwABAxEA-AE9APkBPgD6AQAAAAMRAPgBPQD5AT4A-gEAAAADEQCAAj0AgQI-AIICAAAAAxEAgAI9AIECPgCCAisCASx5AS17AS58AS99ATF_ATKBAR0zggEeNIQBATWGAR02hwEfOYgBATqJAQE7igEdP40BIECOASRBjwECQpABAkORAQJEkgECRZMBAkaVAQJHlwEdSJgBJUmaAQJKnAEdS50BJkyeAQJNnwECTqABHU-jASdQpAErUaUBA1KmAQNTpwEDVKgBA1WpAQNWqwEDV60BHViuASxZsAEDWrIBHVuzAS1ctAEDXbUBA162AR1fuQEuYLoBMmG8ATNivQEzY8ABM2TBATNlwgEzZsQBM2fGAR1oxwE0ackBM2rLAR1rzAE1bM0BM23OATNuzwEdb9IBNnDTATpx1QEEctYBBHPYAQR02QEEddoBBHbcAQR33gEdeN8BO3nhAQR64wEde-QBPHzlAQR95gEEfucBHYEB6gE9ggHrAUODAe0BBYQB7gEFhQHwAQWGAfEBBYcB8gEFiAH0AQWJAfYBHYoB9wFEiwH5AQWMAfsBHY0B_AFFjgH9AQWPAf4BBZAB_wEdkQGCAkaSAYMCSpMBhQIHlAGGAgeVAYgCB5YBiQIHlwGKAgeYAYwCB5kBjgIdmgGPAkubAZECB5wBkwIdnQGUAkyeAZUCB58BlgIHoAGXAh2hAZoCTaIBmwJTowGcAgakAZ0CBqUBngIGpgGfAganAaACBqgBogIGqQGkAh2qAaUCVKsBpwIGrAGpAh2tAaoCVa4BqwIGrwGsAgawAa0CHbEBsAJWsgGxAlqzAbICDbQBswINtQG0Ag22AbUCDbcBtgINuAG4Ag25AboCHboBuwJbuwG9Ag28Ab8CHb0BwAJcvgHBAg2_AcICDcABwwIdwQHGAl3CAccCYcMByAIOxAHJAg7FAcoCDsYBywIOxwHMAg7IAc4CDskB0AIdygHRAmLLAdMCDswB1QIdzQHWAmPOAdcCDs8B2AIO0AHZAh3RAdwCZNIB3QJo0wHeAhDUAd8CENUB4AIQ1gHhAhDXAeICENgB5AIQ2QHmAh3aAecCadsB6QIQ3AHrAh3dAewCat4B7QIQ3wHuAhDgAe8CHeEB8gJr4gHzAm_jAfQCEeQB9QIR5QH2AhHmAfcCEecB-AIR6AH6AhHpAfwCHeoB_QJw6wH_AhHsAYEDHe0BggNx7gGDAxHvAYQDEfABhQMd8QGIA3LyAYkDdvMBigMJ9AGLAwn1AYwDCfYBjQMJ9wGOAwn4AZADCfkBkgMd-gGTA3f7AZYDCfwBmAMd_QGZA3j-AZsDCf8BnAMJgAKdAx2BAqADeYICoQN_gwKiAwqEAqMDCoUCpAMKhgKlAwqHAqYDCogCqAMKiQKqAx2KAqsDgAGLAq4DCowCsAMdjQKxA4EBjgKzAwqPArQDCpACtQMdkQK4A4IBkgK5A4gBkwK6AwiUArsDCJUCvAMIlgK9AwiXAr4DCJgCwAMImQLCAx2aAsMDiQGbAsYDCJwCyAMdnQLJA4oBngLLAwifAswDCKACzQMdoQLQA4sBogLRA5EBowLSAxSkAtMDFKUC1AMUpgLVAxSnAtYDFKgC2AMUqQLaAx2qAtsDkgGrAt0DFKwC3wMdrQLgA5MBrgLhAxSvAuIDFLAC4wMdsQLmA5QBsgLnA5gBswLoAxW0AukDFbUC6gMVtgLrAxW3AuwDFbgC7gMVuQLwAx26AvEDmQG7AvMDFbwC9QMdvQL2A5oBvgL3AxW_AvgDFcAC-QMdwQL8A5sBwgL9A58BwwL-AxfEAv8DF8UCgAQXxgKBBBfHAoIEF8gChAQXyQKGBB3KAocEoAHLAokEF8wCiwQdzQKMBKEBzgKNBBfPAo4EF9ACjwQd0QKSBKIB0gKTBKYB0wKUBBjUApUEGNUClgQY1gKXBBjXApgEGNgCmgQY2QKcBB3aAp0EpwHbAp8EGNwCoQQd3QKiBKgB3gKjBBjfAqQEGOACpQQd4QKoBKkB4gKpBK0B4wKqBAzkAqsEDOUCrAQM5gKtBAznAq4EDOgCsAQM6QKyBB3qArMErgHrArUEDOwCtwQd7QK4BK8B7gK5BAzvAroEDPACuwQd8QK-BLAB8gK_BLYB8wLBBLcB9ALCBLcB9QLFBLcB9gLGBLcB9wLHBLcB-ALJBLcB-QLLBB36AswEuAH7As4EtwH8AtAEHf0C0QS5Af4C0gS3Af8C0wS3AYAD1AQdgQPXBLoBggPYBL4BhQPaBL8BhgPgBL8BhwPjBL8BiAPkBL8BiQPlBL8BigPnBL8BiwPpBB2MA-oEwgGNA-wEvwGOA-4EHY8D7wTDAZAD8AS_AZED8QS_AZID8gQdkwP1BMQBlAP2BMoBlQP3BMABlgP4BMABlwP5BMABmAP6BMABmQP7BMABmgP9BMABmwP_BB2cA4AFywGdA4IFwAGeA4QFHZ8DhQXMAaADhgXAAaEDhwXAAaIDiAUdowOLBc0BpAOMBdMBpQOOBdQBpgOPBdQBpwOSBdQBqAOTBdQBqQOUBdQBqgOWBdQBqwOYBR2sA5kF1QGtA5sF1AGuA50FHa8DngXWAbADnwXUAbEDoAXUAbIDoQUdswOkBdcBtAOlBdsBtQOnBdwBtgOoBdwBtwOrBdwBuAOsBdwBuQOtBdwBugOvBdwBuwOxBR28A7IF3QG9A7QF3AG-A7YFHb8DtwXeAcADuAXcAcEDuQXcAcIDugUdwwO9Bd8BxAO-BeMBxQO_BRrGA8AFGscDwQUayAPCBRrJA8MFGsoDxQUaywPHBR3MA8gF5AHNA8oFGs4DzAUdzwPNBeUB0APOBRrRA88FGtID0AUd0wPTBeYB1APUBeoB1QPWBesB1gPXBesB1wPaBesB2APbBesB2QPcBesB2gPeBesB2wPgBR3cA-EF7AHdA-MF6wHeA-UFHd8D5gXtAeAD5wXrAeED6AXrAeID6QUd4wPsBe4B5APtBfQB5QPuBRvmA-8FG-cD8AUb6APxBRvpA_IFG-oD9AUb6wP2BR3sA_cF9QHtA_kFG-4D-wUd7wP8BfYB8AP9BRvxA_4FG_ID_wUd8wOCBvcB9AODBvsB9QOFBvwB9gOGBvwB9wOJBvwB-AOKBvwB-QOLBvwB-gONBvwB-wOPBh38A5AG_QH9A5IG_AH-A5QGHf8DlQb-AYAElgb8AYEElwb8AYIEmAYdgwSbBv8BhAScBoMC"
};
async function decodeBase64AsWasm(wasmBase64) {
  const { Buffer: Buffer2 } = await import("buffer");
  const wasmArray = Buffer2.from(wasmBase64, "base64");
  return new WebAssembly.Module(wasmArray);
}
config.compilerWasm = {
  getRuntime: async () => await import("@prisma/client/runtime/query_compiler_fast_bg.postgresql.mjs"),
  getQueryCompilerWasmModule: async () => {
    const { wasm } = await import("@prisma/client/runtime/query_compiler_fast_bg.postgresql.wasm-base64.mjs");
    return await decodeBase64AsWasm(wasm);
  },
  importName: "./query_compiler_fast_bg.js"
};
function getPrismaClientClass() {
  return runtime.getPrismaClient(config);
}

// generated/prisma/internal/prismaNamespace.ts
var prismaNamespace_exports = {};
__export(prismaNamespace_exports, {
  AcademicCalendarScalarFieldEnum: () => AcademicCalendarScalarFieldEnum,
  AccountScalarFieldEnum: () => AccountScalarFieldEnum,
  AlumniScalarFieldEnum: () => AlumniScalarFieldEnum,
  AnnouncementCommentScalarFieldEnum: () => AnnouncementCommentScalarFieldEnum,
  AnyNull: () => AnyNull2,
  AssessmentScalarFieldEnum: () => AssessmentScalarFieldEnum,
  BloodPostScalarFieldEnum: () => BloodPostScalarFieldEnum,
  BloodResponseScalarFieldEnum: () => BloodResponseScalarFieldEnum,
  BusScheduleScalarFieldEnum: () => BusScheduleScalarFieldEnum,
  CalendarEventScalarFieldEnum: () => CalendarEventScalarFieldEnum,
  CampusEventScalarFieldEnum: () => CampusEventScalarFieldEnum,
  ComplaintScalarFieldEnum: () => ComplaintScalarFieldEnum,
  CourseHubScalarFieldEnum: () => CourseHubScalarFieldEnum,
  CourseReviewScalarFieldEnum: () => CourseReviewScalarFieldEnum,
  DbNull: () => DbNull2,
  Decimal: () => Decimal2,
  FieldBookingScalarFieldEnum: () => FieldBookingScalarFieldEnum,
  FieldSettingScalarFieldEnum: () => FieldSettingScalarFieldEnum,
  HelpPostScalarFieldEnum: () => HelpPostScalarFieldEnum,
  HelpResponseScalarFieldEnum: () => HelpResponseScalarFieldEnum,
  HubAnnouncementScalarFieldEnum: () => HubAnnouncementScalarFieldEnum,
  HubDiscussionReplyScalarFieldEnum: () => HubDiscussionReplyScalarFieldEnum,
  HubDiscussionScalarFieldEnum: () => HubDiscussionScalarFieldEnum,
  HubMemberScalarFieldEnum: () => HubMemberScalarFieldEnum,
  JsonNull: () => JsonNull2,
  JsonNullValueFilter: () => JsonNullValueFilter,
  JsonNullValueInput: () => JsonNullValueInput,
  ModelName: () => ModelName,
  NoticeScalarFieldEnum: () => NoticeScalarFieldEnum,
  NullTypes: () => NullTypes2,
  NullableJsonNullValueInput: () => NullableJsonNullValueInput,
  NullsOrder: () => NullsOrder,
  PrismaClientInitializationError: () => PrismaClientInitializationError2,
  PrismaClientKnownRequestError: () => PrismaClientKnownRequestError2,
  PrismaClientRustPanicError: () => PrismaClientRustPanicError2,
  PrismaClientUnknownRequestError: () => PrismaClientUnknownRequestError2,
  PrismaClientValidationError: () => PrismaClientValidationError2,
  QueryMode: () => QueryMode,
  ResourceScalarFieldEnum: () => ResourceScalarFieldEnum,
  SessionScalarFieldEnum: () => SessionScalarFieldEnum,
  SortOrder: () => SortOrder,
  Sql: () => Sql2,
  StudentProfileScalarFieldEnum: () => StudentProfileScalarFieldEnum,
  SubmissionScalarFieldEnum: () => SubmissionScalarFieldEnum,
  TeacherProfileScalarFieldEnum: () => TeacherProfileScalarFieldEnum,
  TransactionIsolationLevel: () => TransactionIsolationLevel,
  UserScalarFieldEnum: () => UserScalarFieldEnum,
  VerificationScalarFieldEnum: () => VerificationScalarFieldEnum,
  defineExtension: () => defineExtension,
  empty: () => empty2,
  getExtensionContext: () => getExtensionContext,
  join: () => join2,
  prismaVersion: () => prismaVersion,
  raw: () => raw2,
  sql: () => sql
});
import * as runtime2 from "@prisma/client/runtime/client";
var PrismaClientKnownRequestError2 = runtime2.PrismaClientKnownRequestError;
var PrismaClientUnknownRequestError2 = runtime2.PrismaClientUnknownRequestError;
var PrismaClientRustPanicError2 = runtime2.PrismaClientRustPanicError;
var PrismaClientInitializationError2 = runtime2.PrismaClientInitializationError;
var PrismaClientValidationError2 = runtime2.PrismaClientValidationError;
var sql = runtime2.sqltag;
var empty2 = runtime2.empty;
var join2 = runtime2.join;
var raw2 = runtime2.raw;
var Sql2 = runtime2.Sql;
var Decimal2 = runtime2.Decimal;
var getExtensionContext = runtime2.Extensions.getExtensionContext;
var prismaVersion = {
  client: "7.8.0",
  engine: "3c6e192761c0362d496ed980de936e2f3cebcd3a"
};
var NullTypes2 = {
  DbNull: runtime2.NullTypes.DbNull,
  JsonNull: runtime2.NullTypes.JsonNull,
  AnyNull: runtime2.NullTypes.AnyNull
};
var DbNull2 = runtime2.DbNull;
var JsonNull2 = runtime2.JsonNull;
var AnyNull2 = runtime2.AnyNull;
var ModelName = {
  User: "User",
  Session: "Session",
  Account: "Account",
  Verification: "Verification",
  StudentProfile: "StudentProfile",
  TeacherProfile: "TeacherProfile",
  CourseHub: "CourseHub",
  HubMember: "HubMember",
  HubAnnouncement: "HubAnnouncement",
  AnnouncementComment: "AnnouncementComment",
  HubDiscussion: "HubDiscussion",
  HubDiscussionReply: "HubDiscussionReply",
  Assessment: "Assessment",
  Submission: "Submission",
  Resource: "Resource",
  HelpPost: "HelpPost",
  HelpResponse: "HelpResponse",
  BloodPost: "BloodPost",
  BloodResponse: "BloodResponse",
  CourseReview: "CourseReview",
  BusSchedule: "BusSchedule",
  AcademicCalendar: "AcademicCalendar",
  CalendarEvent: "CalendarEvent",
  Notice: "Notice",
  CampusEvent: "CampusEvent",
  Complaint: "Complaint",
  Alumni: "Alumni",
  FieldBooking: "FieldBooking",
  FieldSetting: "FieldSetting"
};
var TransactionIsolationLevel = runtime2.makeStrictEnum({
  ReadUncommitted: "ReadUncommitted",
  ReadCommitted: "ReadCommitted",
  RepeatableRead: "RepeatableRead",
  Serializable: "Serializable"
});
var UserScalarFieldEnum = {
  id: "id",
  email: "email",
  emailVerified: "emailVerified",
  name: "name",
  image: "image",
  role: "role",
  phoneNumber: "phoneNumber",
  bloodGroup: "bloodGroup",
  createdAt: "createdAt",
  updatedAt: "updatedAt"
};
var SessionScalarFieldEnum = {
  id: "id",
  userId: "userId",
  token: "token",
  expiresAt: "expiresAt",
  ipAddress: "ipAddress",
  userAgent: "userAgent",
  createdAt: "createdAt",
  updatedAt: "updatedAt"
};
var AccountScalarFieldEnum = {
  id: "id",
  userId: "userId",
  accountId: "accountId",
  providerId: "providerId",
  accessToken: "accessToken",
  refreshToken: "refreshToken",
  idToken: "idToken",
  accessTokenExpiresAt: "accessTokenExpiresAt",
  refreshTokenExpiresAt: "refreshTokenExpiresAt",
  scope: "scope",
  password: "password",
  createdAt: "createdAt",
  updatedAt: "updatedAt"
};
var VerificationScalarFieldEnum = {
  id: "id",
  identifier: "identifier",
  value: "value",
  expiresAt: "expiresAt",
  createdAt: "createdAt",
  updatedAt: "updatedAt"
};
var StudentProfileScalarFieldEnum = {
  id: "id",
  userId: "userId",
  studentId: "studentId",
  faculty: "faculty",
  department: "department",
  program: "program",
  batch: "batch",
  currentSemester: "currentSemester",
  section: "section",
  isCR: "isCR",
  isTA: "isTA",
  skills: "skills",
  linkedInUrl: "linkedInUrl",
  personalWebsiteUrl: "personalWebsiteUrl"
};
var TeacherProfileScalarFieldEnum = {
  id: "id",
  userId: "userId",
  teacherId: "teacherId",
  designation: "designation",
  department: "department",
  faculty: "faculty",
  officeRoom: "officeRoom",
  consultationHours: "consultationHours",
  expertiseFields: "expertiseFields",
  academicQualifications: "academicQualifications",
  linkedInUrl: "linkedInUrl",
  personalWebsiteUrl: "personalWebsiteUrl"
};
var CourseHubScalarFieldEnum = {
  id: "id",
  courseCode: "courseCode",
  courseName: "courseName",
  credit: "credit",
  termOffer: "termOffer",
  weeklyClassSchedule: "weeklyClassSchedule",
  termExams: "termExams",
  joinCode: "joinCode",
  isArchived: "isArchived",
  department: "department",
  batch: "batch",
  semesterNumber: "semesterNumber",
  isReviewOpen: "isReviewOpen",
  reviewQuestions: "reviewQuestions",
  createdAt: "createdAt"
};
var HubMemberScalarFieldEnum = {
  id: "id",
  userId: "userId",
  hubId: "hubId",
  role: "role",
  isActive: "isActive"
};
var HubAnnouncementScalarFieldEnum = {
  id: "id",
  hubId: "hubId",
  creatorId: "creatorId",
  content: "content",
  attachedLinkUrl: "attachedLinkUrl",
  attachedLinkTitle: "attachedLinkTitle",
  createdAt: "createdAt"
};
var AnnouncementCommentScalarFieldEnum = {
  id: "id",
  content: "content",
  announcementId: "announcementId",
  authorId: "authorId",
  createdAt: "createdAt"
};
var HubDiscussionScalarFieldEnum = {
  id: "id",
  hubId: "hubId",
  authorId: "authorId",
  title: "title",
  content: "content",
  createdAt: "createdAt"
};
var HubDiscussionReplyScalarFieldEnum = {
  id: "id",
  discussionId: "discussionId",
  authorId: "authorId",
  content: "content",
  createdAt: "createdAt"
};
var AssessmentScalarFieldEnum = {
  id: "id",
  hubId: "hubId",
  creatorId: "creatorId",
  title: "title",
  description: "description",
  type: "type",
  submissionType: "submissionType",
  deadline: "deadline",
  totalMarks: "totalMarks",
  createdAt: "createdAt"
};
var SubmissionScalarFieldEnum = {
  id: "id",
  assessmentId: "assessmentId",
  studentId: "studentId",
  submittedUrl: "submittedUrl",
  marks: "marks",
  gradedById: "gradedById",
  createdAt: "createdAt"
};
var ResourceScalarFieldEnum = {
  id: "id",
  title: "title",
  driveUrl: "driveUrl",
  uploaderId: "uploaderId",
  hubId: "hubId",
  isStudentNote: "isStudentNote",
  rating: "rating",
  createdAt: "createdAt"
};
var HelpPostScalarFieldEnum = {
  id: "id",
  authorId: "authorId",
  title: "title",
  description: "description",
  isResolved: "isResolved",
  createdAt: "createdAt"
};
var HelpResponseScalarFieldEnum = {
  id: "id",
  postId: "postId",
  responderId: "responderId",
  content: "content",
  createdAt: "createdAt"
};
var BloodPostScalarFieldEnum = {
  id: "id",
  authorId: "authorId",
  patientName: "patientName",
  patientCondition: "patientCondition",
  bloodGroup: "bloodGroup",
  location: "location",
  urgency: "urgency",
  contactPhone: "contactPhone",
  isFulfilled: "isFulfilled",
  createdAt: "createdAt"
};
var BloodResponseScalarFieldEnum = {
  id: "id",
  postId: "postId",
  responderId: "responderId",
  message: "message",
  createdAt: "createdAt"
};
var CourseReviewScalarFieldEnum = {
  id: "id",
  hubId: "hubId",
  studentId: "studentId",
  rating: "rating",
  comment: "comment",
  isAnonymous: "isAnonymous",
  answers: "answers",
  createdAt: "createdAt"
};
var BusScheduleScalarFieldEnum = {
  id: "id",
  route: "route",
  busNumber: "busNumber",
  departureTime: "departureTime",
  stops: "stops",
  createdAt: "createdAt"
};
var AcademicCalendarScalarFieldEnum = {
  id: "id",
  title: "title",
  semester: "semester",
  academicYear: "academicYear",
  status: "status",
  isActive: "isActive",
  isGlobal: "isGlobal",
  targetFaculties: "targetFaculties",
  targetDepartments: "targetDepartments",
  publishedAt: "publishedAt",
  createdBy: "createdBy",
  updatedBy: "updatedBy",
  createdAt: "createdAt",
  updatedAt: "updatedAt"
};
var CalendarEventScalarFieldEnum = {
  id: "id",
  calendarId: "calendarId",
  title: "title",
  description: "description",
  category: "category",
  startDate: "startDate",
  endDate: "endDate",
  weekNumber: "weekNumber",
  isHoliday: "isHoliday",
  isAllDay: "isAllDay",
  remarks: "remarks",
  createdAt: "createdAt",
  updatedAt: "updatedAt"
};
var NoticeScalarFieldEnum = {
  id: "id",
  referenceNo: "referenceNo",
  title: "title",
  body: "body",
  issuerName: "issuerName",
  issuerDesignation: "issuerDesignation",
  copyTo: "copyTo",
  issueDate: "issueDate",
  createdAt: "createdAt",
  updatedAt: "updatedAt"
};
var CampusEventScalarFieldEnum = {
  id: "id",
  title: "title",
  description: "description",
  location: "location",
  eventDate: "eventDate",
  createdAt: "createdAt",
  updatedAt: "updatedAt"
};
var ComplaintScalarFieldEnum = {
  id: "id",
  userId: "userId",
  title: "title",
  description: "description",
  category: "category",
  status: "status",
  createdAt: "createdAt",
  updatedAt: "updatedAt"
};
var AlumniScalarFieldEnum = {
  id: "id",
  name: "name",
  email: "email",
  batch: "batch",
  graduationYear: "graduationYear",
  department: "department",
  degree: "degree",
  currentCompany: "currentCompany",
  currentPosition: "currentPosition",
  skills: "skills",
  linkedInUrl: "linkedInUrl",
  personalWebsiteUrl: "personalWebsiteUrl",
  image: "image",
  createdAt: "createdAt",
  updatedAt: "updatedAt"
};
var FieldBookingScalarFieldEnum = {
  id: "id",
  userId: "userId",
  purpose: "purpose",
  bookingDate: "bookingDate",
  startTime: "startTime",
  endTime: "endTime",
  status: "status",
  createdAt: "createdAt",
  updatedAt: "updatedAt"
};
var FieldSettingScalarFieldEnum = {
  id: "id",
  isBookingOpen: "isBookingOpen",
  closedNotice: "closedNotice",
  updatedAt: "updatedAt"
};
var SortOrder = {
  asc: "asc",
  desc: "desc"
};
var NullableJsonNullValueInput = {
  DbNull: DbNull2,
  JsonNull: JsonNull2
};
var JsonNullValueInput = {
  JsonNull: JsonNull2
};
var QueryMode = {
  default: "default",
  insensitive: "insensitive"
};
var NullsOrder = {
  first: "first",
  last: "last"
};
var JsonNullValueFilter = {
  DbNull: DbNull2,
  JsonNull: JsonNull2,
  AnyNull: AnyNull2
};
var defineExtension = runtime2.Extensions.defineExtension;

// generated/prisma/enums.ts
var SystemRole = {
  ADMIN: "ADMIN",
  STUDENT: "STUDENT",
  TEACHER: "TEACHER"
};
var HubRole = {
  TEACHER: "TEACHER",
  CR: "CR",
  TA: "TA",
  STUDENT: "STUDENT"
};
var AssessmentType = {
  ASSIGNMENT: "ASSIGNMENT",
  QUIZ: "QUIZ",
  PRESENTATION: "PRESENTATION"
};
var SubmissionType = {
  ONLINE: "ONLINE",
  HAND: "HAND"
};
var BloodGroup = {
  A_POSITIVE: "A_POSITIVE",
  A_NEGATIVE: "A_NEGATIVE",
  B_POSITIVE: "B_POSITIVE",
  B_NEGATIVE: "B_NEGATIVE",
  AB_POSITIVE: "AB_POSITIVE",
  AB_NEGATIVE: "AB_NEGATIVE",
  O_POSITIVE: "O_POSITIVE",
  O_NEGATIVE: "O_NEGATIVE"
};
var ComplaintStatus = {
  PENDING: "PENDING",
  RESOLVED: "RESOLVED",
  REJECTED: "REJECTED"
};
var BookingStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED"
};

// generated/prisma/client.ts
globalThis["__dirname"] = path.dirname(fileURLToPath(import.meta.url));
var PrismaClient = getPrismaClientClass();

// src/lib/prisma.ts
var connectionString = `${process.env.DATABASE_URL}`;
var adapter = new PrismaPg({ connectionString });
var prisma = new PrismaClient({ adapter });

// src/lib/auth.ts
import { bearer } from "better-auth/plugins";

// src/config/env.ts
import dotenv from "dotenv";
import { z } from "zod";
dotenv.config();
var urlValidator = z.string().refine(
  (url) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },
  { message: "Invalid URL format" }
);
var envSchema = z.object({
  DATABASE_URL: urlValidator.describe("Transaction pooler URL for app queries"),
  DIRECT_URL: urlValidator.describe(
    "Direct connection URL for Prisma migrations"
  ),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: urlValidator,
  TRUSTED_ORIGINS: z.string().optional(),
  FRONTEND_URL: urlValidator,
  BREVO_API_KEY: z.string().min(1, "Brevo API key is required"),
  SMTP_HOST: z.string().default("smtp.gmail.com"),
  SMTP_PORT: z.coerce.number().default(465),
  SMTP_USER: z.string().email(),
  SMTP_PASS: z.string().min(16),
  EMAIL_FROM: z.string().email(),
  PORT: z.coerce.number().default(5e3),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development")
});
var parsedEnv;
try {
  parsedEnv = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error("\u274C Invalid Environment Variables:");
    error.issues.forEach((issue) => {
      console.error(`   - ${issue.path.join(".")}: ${issue.message}`);
    });
  } else {
    console.error("\u274C Environment validation failed:", error);
  }
  process.exit(1);
}
var envConfig = parsedEnv;

// src/lib/email.ts
var sendEmail = async (options) => {
  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "api-key": envConfig.BREVO_API_KEY
      },
      body: JSON.stringify({
        sender: {
          name: "SMUCT UniCompanion",
          email: envConfig.EMAIL_FROM
        },
        to: [
          {
            email: options.to
          }
        ],
        subject: options.subject,
        htmlContent: options.html
      })
    });
    if (!response.ok) {
      const errorData = await response.json();
      console.error(`\u274C Brevo API Error sending to ${options.to}:`, errorData);
      return false;
    }
    console.log(`\u2705 Email sent successfully via Brevo to ${options.to}`);
    return true;
  } catch (error) {
    console.error(
      `\u274C Network/Server Error sending email to ${options.to}:`,
      error
    );
    return false;
  }
};

// src/lib/auth.ts
var parsedTrustedOrigins = envConfig.TRUSTED_ORIGINS ? envConfig.TRUSTED_ORIGINS.split(",").map((url) => url.trim()) : [];
var auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  trustedOrigins: [
    "smuct-unicompanion://",
    envConfig.FRONTEND_URL,
    ...parsedTrustedOrigins
  ],
  user: {
    additionalFields: {
      role: { type: "string", required: false },
      phoneNumber: { type: "string", required: false },
      bloodGroup: { type: "string", required: false }
    }
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url, token }) => {
      const resetLink = `${envConfig.FRONTEND_URL}?token=${encodeURIComponent(token)}&type=reset-password`;
      await sendEmail({
        to: user.email,
        subject: "Reset Your Password - SMUCT UniCompanion",
        html: `
      <h2>Password Reset Request</h2>
      <a href="${resetLink}" style="...">Reset Password</a>
    `
      });
    }
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url, token }) => {
      if (user.role === "TEACHER") return;
      const verificationLink = `${envConfig.FRONTEND_URL}?token=${encodeURIComponent(token)}&type=verify-email`;
      await sendEmail({
        to: user.email,
        subject: "Welcome to SMUCT UniCompanion! Verify your email",
        html: `
      <h2>Welcome aboard! \u{1F680}</h2>
      <a href="${verificationLink}" style="...">Verify My Email</a>
    `
      });
    }
  },
  plugins: [bearer()]
});

// src/modules/student/student.routes.ts
import { Router } from "express";

// src/middleware/auth.middleware.ts
var requireAuth = async (req, res, next) => {
  try {
    const session = await auth.api.getSession({
      headers: new Headers(req.headers)
    });
    if (!session || !session.user) {
      res.status(401).json({ error: "Unauthorized. Please log in first." });
      return;
    }
    req.user = session.user;
    next();
  } catch (error) {
    res.status(500).json({
      error: "Internal server error during authentication validation."
    });
  }
};

// src/middleware/validateRequest.ts
var validateRequest = (schema) => {
  return async (req, res, next) => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params
      });
      if (parsed?.body !== void 0) {
        req.body = parsed.body;
      }
      if (parsed?.query !== void 0) {
        Object.defineProperty(req, "query", {
          value: parsed.query,
          writable: true,
          configurable: true,
          enumerable: true
        });
      }
      if (parsed?.params !== void 0) {
        Object.defineProperty(req, "params", {
          value: parsed.params,
          writable: true,
          configurable: true,
          enumerable: true
        });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};

// src/modules/student/student.schema.ts
import { z as z2 } from "zod";

// src/constants/enums.ts
var BLOOD_GROUP_VALUES = [
  BloodGroup.A_POSITIVE,
  BloodGroup.A_NEGATIVE,
  BloodGroup.B_POSITIVE,
  BloodGroup.B_NEGATIVE,
  BloodGroup.AB_POSITIVE,
  BloodGroup.AB_NEGATIVE,
  BloodGroup.O_POSITIVE,
  BloodGroup.O_NEGATIVE
];
var SYSTEM_ROLE_VALUES = [
  SystemRole.ADMIN,
  SystemRole.STUDENT,
  SystemRole.TEACHER
];
var HUB_ROLE_VALUES = [
  HubRole.TEACHER,
  HubRole.CR,
  HubRole.TA,
  HubRole.STUDENT
];
var ASSESSMENT_TYPE_VALUES = [
  AssessmentType.ASSIGNMENT,
  AssessmentType.QUIZ,
  AssessmentType.PRESENTATION
];
var SUBMISSION_TYPE_VALUES = [
  SubmissionType.ONLINE,
  SubmissionType.HAND
];
var COMPLAINT_STATUS_VALUES = [
  ComplaintStatus.PENDING,
  ComplaintStatus.RESOLVED,
  ComplaintStatus.REJECTED
];
var BOOKING_STATUS_VALUES = [
  BookingStatus.PENDING,
  BookingStatus.APPROVED,
  BookingStatus.REJECTED
];

// src/modules/student/student.schema.ts
var onboardStudentSchema = z2.object({
  body: z2.object({
    studentId: z2.string().min(1, "Student ID is required"),
    faculty: z2.string().min(1, "Faculty is required"),
    department: z2.string().min(1, "Department is required"),
    program: z2.string().min(1, "Program is required"),
    batch: z2.string().min(1, "Batch is required"),
    currentSemester: z2.number().min(1).max(12, "Semester must be between 1 and 12"),
    section: z2.string().min(1, "Section is required")
  })
});
var updateProfileImageSchema = z2.object({
  body: z2.object({
    imageUrl: z2.string().url("Must be a valid URL")
  })
});
var updateProfileSchema = z2.object({
  body: z2.object({
    name: z2.string().optional(),
    phoneNumber: z2.string().optional(),
    batch: z2.string().optional(),
    currentSemester: z2.number().min(1).max(12).optional(),
    section: z2.string().optional(),
    bloodGroup: z2.enum(BLOOD_GROUP_VALUES).optional(),
    faculty: z2.string().optional(),
    program: z2.string().optional(),
    skills: z2.array(z2.string()).optional(),
    linkedInUrl: z2.string().url({ message: "Must be a valid URL" }).or(z2.literal("")).optional(),
    personalWebsiteUrl: z2.string().url({ message: "Must be a valid URL" }).or(z2.literal("")).optional()
  })
});

// src/utils/AppError.ts
var AppError = class extends Error {
  statusCode;
  isOperational;
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
};

// src/modules/student/student.repository.ts
var findStudentProfileByUserId = async (userId) => {
  return await prisma.studentProfile.findUnique({
    where: { userId }
  });
};
var createStudentProfileWithRole = async (userId, data) => {
  return await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { role: "STUDENT" }
    });
    return await tx.studentProfile.create({
      data: {
        userId,
        studentId: data.studentId,
        faculty: data.faculty,
        department: data.department,
        program: data.program,
        batch: data.batch,
        currentSemester: data.currentSemester,
        section: data.section,
        isCR: false,
        isTA: false
      }
    });
  });
};
var updateStudentUserImage = async (userId, imageUrl) => {
  return await prisma.user.update({
    where: { id: userId },
    data: { image: imageUrl },
    select: { id: true, name: true, image: true }
  });
};
var findStudentUserById = async (userId) => {
  return await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      phoneNumber: true,
      bloodGroup: true,
      role: true,
      studentProfile: {
        select: {
          studentId: true,
          faculty: true,
          department: true,
          program: true,
          batch: true,
          currentSemester: true,
          section: true,
          isCR: true,
          isTA: true,
          skills: true,
          linkedInUrl: true,
          personalWebsiteUrl: true
        }
      }
    }
  });
};
var updateStudentUserAndProfile = async (userId, userUpdateData, profileUpdateData) => {
  return await prisma.$transaction(async (tx) => {
    if (Object.keys(userUpdateData).length > 0) {
      await tx.user.update({
        where: { id: userId },
        data: userUpdateData
      });
    }
    if (Object.keys(profileUpdateData).length > 0) {
      await tx.studentProfile.update({
        where: { userId },
        data: profileUpdateData
      });
    }
    return await findStudentUserById(userId);
  });
};

// src/modules/student/student.service.ts
var onboardStudentService = async (userId, data) => {
  const existingProfile = await findStudentProfileByUserId(userId);
  if (existingProfile) {
    throw new AppError("A student profile already exists for this user.", 409);
  }
  return await createStudentProfileWithRole(userId, data);
};
var updateProfileImageService = async (userId, imageUrl) => {
  return await updateStudentUserImage(userId, imageUrl);
};
var getStudentProfileByUserId = async (userId) => {
  return await findStudentUserById(userId);
};
var updateStudentProfileData = async (userId, data) => {
  const userUpdateData = {};
  if (data.name) userUpdateData.name = data.name;
  if (data.phoneNumber !== void 0)
    userUpdateData.phoneNumber = data.phoneNumber;
  if (data.bloodGroup !== void 0)
    userUpdateData.bloodGroup = data.bloodGroup;
  const profileUpdateData = {};
  if (data.batch) profileUpdateData.batch = data.batch;
  if (data.currentSemester)
    profileUpdateData.currentSemester = data.currentSemester;
  if (data.section !== void 0) profileUpdateData.section = data.section;
  if (data.skills !== void 0) profileUpdateData.skills = data.skills;
  if (data.linkedInUrl !== void 0)
    profileUpdateData.linkedInUrl = data.linkedInUrl;
  if (data.personalWebsiteUrl !== void 0)
    profileUpdateData.personalWebsiteUrl = data.personalWebsiteUrl;
  return await updateStudentUserAndProfile(
    userId,
    userUpdateData,
    profileUpdateData
  );
};

// src/utils/catchAsync.ts
var catchAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((err) => next(err));
  };
};

// src/modules/student/student.controller.ts
var onboardStudent = catchAsync(
  async (req, res) => {
    const userId = req.user.id;
    const result = await onboardStudentService(userId, req.body);
    res.status(201).json({
      success: true,
      message: "Student profile created successfully.",
      data: result
    });
  }
);
var updateProfileImage = catchAsync(
  async (req, res) => {
    const userId = req.user.id;
    const { imageUrl } = req.body;
    const updatedUser = await updateProfileImageService(
      userId,
      imageUrl
    );
    res.status(200).json({
      success: true,
      message: "Profile image updated successfully.",
      data: updatedUser
    });
  }
);
var getStudentProfile = catchAsync(
  async (req, res) => {
    const userId = req.user.id;
    const userProfile = await getStudentProfileByUserId(userId);
    if (!userProfile || !userProfile.studentProfile) {
      throw new AppError("Student profile not found.", 404);
    }
    const formattedProfile = {
      id: userProfile.id,
      name: userProfile.name,
      email: userProfile.email,
      image: userProfile.image,
      phoneNumber: userProfile.phoneNumber,
      bloodGroup: userProfile.bloodGroup,
      role: userProfile.role,
      ...userProfile.studentProfile
    };
    res.status(200).json({
      success: true,
      message: "Profile retrieved successfully.",
      data: formattedProfile
    });
  }
);
var updateProfile = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const updatedProfile = await updateStudentProfileData(
    userId,
    req.body
  );
  if (!updatedProfile) {
    throw new AppError("Failed to retrieve updated profile.", 500);
  }
  const formattedProfile = {
    id: updatedProfile.id,
    name: updatedProfile.name,
    email: updatedProfile.email,
    image: updatedProfile.image,
    phoneNumber: updatedProfile.phoneNumber,
    bloodGroup: updatedProfile.bloodGroup,
    role: updatedProfile.role,
    ...updatedProfile.studentProfile
  };
  res.status(200).json({
    success: true,
    message: "Profile updated successfully.",
    data: formattedProfile
  });
});

// src/modules/student/student.routes.ts
var router = Router();
router.post(
  "/onboard",
  requireAuth,
  validateRequest(onboardStudentSchema),
  onboardStudent
);
router.patch(
  "/profile/image",
  requireAuth,
  validateRequest(updateProfileImageSchema),
  updateProfileImage
);
router.get("/profile", requireAuth, getStudentProfile);
router.patch(
  "/profile",
  requireAuth,
  validateRequest(updateProfileSchema),
  updateProfile
);
var studentRoutes = router;

// src/middleware/globalErrorHandler.ts
import { ZodError } from "zod";
var globalErrorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";
  let errorSources = [];
  if (err instanceof ZodError) {
    statusCode = 400;
    message = "Validation Error";
    errorSources = err.issues.map((issue) => ({
      path: issue.path[issue.path.length - 1],
      message: issue.message
    }));
  } else if (err instanceof prismaNamespace_exports.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      statusCode = 409;
      message = "Duplicate Record Entry";
      errorSources = [
        { path: err.meta?.target, message: "This value is already in use." }
      ];
    }
  } else if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  }
  res.status(statusCode).json({
    success: false,
    message,
    errorSources,
    stack: envConfig.NODE_ENV === "development" ? err.stack : void 0
  });
};

// src/modules/teacher/teacher.routes.ts
import { Router as Router2 } from "express";

// src/middleware/admin.middleware.ts
var requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "ADMIN") {
    return next(new AppError("Forbidden. Administrator access required.", 403));
  }
  next();
};

// src/modules/teacher/teacher.schema.ts
import { z as z3 } from "zod";
var registerTeacherSchema = z3.object({
  body: z3.object({
    teacherId: z3.string().min(1, "Teacher ID is required"),
    name: z3.string().min(1, "Name is required"),
    email: z3.string().email("Invalid email format"),
    password: z3.string().min(8, "Password must be at least 8 characters"),
    designation: z3.string().min(1, "Designation is required (e.g., Lecturer, Professor)"),
    department: z3.string().min(1, "Department is required"),
    faculty: z3.string().min(1, "Faculty is required")
  })
});
var updateTeacherProfileSchema = z3.object({
  body: z3.object({
    name: z3.string().optional(),
    phoneNumber: z3.string().optional(),
    bloodGroup: z3.enum(BLOOD_GROUP_VALUES).optional(),
    designation: z3.string().optional(),
    department: z3.string().optional(),
    faculty: z3.string().optional(),
    officeRoom: z3.string().optional(),
    consultationHours: z3.string().optional(),
    expertiseFields: z3.array(z3.string()).optional(),
    academicQualifications: z3.record(z3.string(), z3.any()).optional(),
    linkedInUrl: z3.string().url("Must be a valid URL").or(z3.literal("")).optional(),
    personalWebsiteUrl: z3.string().url("Must be a valid URL").or(z3.literal("")).optional()
  })
});
var updateTeacherImageSchema = z3.object({
  body: z3.object({
    imageUrl: z3.string().url("Must be a valid URL")
  })
});

// src/modules/teacher/teacher.repository.ts
var findUserByEmail = async (email) => {
  return await prisma.user.findUnique({
    where: { email }
  });
};
var findTeacherProfileByTeacherId = async (teacherId) => {
  return await prisma.teacherProfile.findUnique({
    where: { teacherId }
  });
};
var deleteUserSessions = async (userId) => {
  return await prisma.session.deleteMany({
    where: { userId }
  });
};
var createTeacherProfileRecord = async (data) => {
  return await prisma.teacherProfile.create({
    data
  });
};
var updateUserEmailVerified = async (userId, emailVerified) => {
  return await prisma.user.update({
    where: { id: userId },
    data: { emailVerified }
  });
};
var deleteUserById = async (userId) => {
  return await prisma.user.delete({
    where: { id: userId }
  });
};
var findTeacherUserById = async (userId) => {
  return await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      phoneNumber: true,
      bloodGroup: true,
      role: true,
      teacherProfile: {
        select: {
          teacherId: true,
          designation: true,
          department: true,
          faculty: true,
          officeRoom: true,
          consultationHours: true,
          expertiseFields: true,
          academicQualifications: true,
          linkedInUrl: true,
          personalWebsiteUrl: true
        }
      }
    }
  });
};
var updateTeacherUserImage = async (userId, imageUrl) => {
  return await prisma.user.update({
    where: { id: userId },
    data: { image: imageUrl },
    select: { id: true, name: true, image: true }
  });
};
var updateTeacherUserAndProfile = async (userId, userUpdateData, profileUpdateData) => {
  return await prisma.$transaction(async (tx) => {
    if (Object.keys(userUpdateData).length > 0) {
      await tx.user.update({
        where: { id: userId },
        data: userUpdateData
      });
    }
    if (Object.keys(profileUpdateData).length > 0) {
      await tx.teacherProfile.update({
        where: { userId },
        data: profileUpdateData
      });
    }
    return await findTeacherUserById(userId);
  });
};

// src/modules/teacher/teacher.service.ts
var registerTeacherService = async (data) => {
  const existingEmail = await findUserByEmail(data.email);
  if (existingEmail) {
    throw new AppError("A user with this email already exists.", 409);
  }
  const existingTeacherId = await findTeacherProfileByTeacherId(data.teacherId);
  if (existingTeacherId) {
    throw new AppError(
      "This Teacher ID is already registered in the system.",
      409
    );
  }
  let authResponse;
  try {
    authResponse = await auth.api.signUpEmail({
      body: {
        email: data.email,
        password: data.password,
        name: data.name,
        role: "TEACHER"
      }
    });
  } catch (error) {
    throw new AppError(
      error.message || "Failed to create core user account",
      500
    );
  }
  if (!authResponse?.user) {
    throw new AppError("Unexpected error during teacher registration.", 500);
  }
  const userId = authResponse.user.id;
  try {
    await deleteUserSessions(userId);
    const profile = await createTeacherProfileRecord({
      userId,
      teacherId: data.teacherId,
      designation: data.designation,
      department: data.department,
      faculty: data.faculty
    });
    await updateUserEmailVerified(userId, true);
    await auth.api.forgetPassword({
      body: {
        email: data.email,
        redirectTo: `${envConfig.FRONTEND_URL}?type=reset-password`
      }
    });
    return { user: authResponse.user, profile };
  } catch (error) {
    await deleteUserById(userId);
    console.error("Teacher Profile creation failed, rolled back user:", error);
    throw new AppError(
      "Failed to create teacher profile. Database rolled back.",
      500
    );
  }
};
var getTeacherProfileByUserId = async (userId) => {
  return await findTeacherUserById(userId);
};
var updateTeacherProfileImageService = async (userId, imageUrl) => {
  return await updateTeacherUserImage(userId, imageUrl);
};
var updateTeacherProfileData = async (userId, data) => {
  const userUpdateData = {};
  if (data.name) userUpdateData.name = data.name;
  if (data.phoneNumber !== void 0)
    userUpdateData.phoneNumber = data.phoneNumber;
  if (data.bloodGroup !== void 0)
    userUpdateData.bloodGroup = data.bloodGroup;
  const profileUpdateData = {};
  if (data.designation) profileUpdateData.designation = data.designation;
  if (data.department) profileUpdateData.department = data.department;
  if (data.faculty !== void 0) profileUpdateData.faculty = data.faculty;
  if (data.officeRoom !== void 0)
    profileUpdateData.officeRoom = data.officeRoom;
  if (data.consultationHours !== void 0)
    profileUpdateData.consultationHours = data.consultationHours;
  if (data.expertiseFields !== void 0)
    profileUpdateData.expertiseFields = data.expertiseFields;
  if (data.academicQualifications !== void 0)
    profileUpdateData.academicQualifications = data.academicQualifications;
  if (data.linkedInUrl !== void 0)
    profileUpdateData.linkedInUrl = data.linkedInUrl;
  if (data.personalWebsiteUrl !== void 0)
    profileUpdateData.personalWebsiteUrl = data.personalWebsiteUrl;
  return await updateTeacherUserAndProfile(
    userId,
    userUpdateData,
    profileUpdateData
  );
};

// src/modules/teacher/teacher.controller.ts
var registerTeacher = catchAsync(
  async (req, res) => {
    const result = await registerTeacherService(req.body);
    const formattedData = {
      id: result.user.id,
      teacherId: result.profile.teacherId,
      name: result.user.name,
      email: result.user.email,
      role: result.user.role,
      designation: result.profile.designation,
      department: result.profile.department,
      faculty: result.profile.faculty
    };
    res.status(201).json({
      success: true,
      message: "Teacher registered successfully by Administrator.",
      data: formattedData
    });
  }
);
var getTeacherProfile = catchAsync(
  async (req, res) => {
    const userId = req.user.id;
    const userProfile = await getTeacherProfileByUserId(userId);
    if (!userProfile || !userProfile.teacherProfile) {
      throw new AppError("Teacher profile not found.", 404);
    }
    const formattedProfile = {
      id: userProfile.id,
      name: userProfile.name,
      email: userProfile.email,
      image: userProfile.image,
      phoneNumber: userProfile.phoneNumber,
      bloodGroup: userProfile.bloodGroup,
      role: userProfile.role,
      ...userProfile.teacherProfile
    };
    res.status(200).json({
      success: true,
      message: "Teacher profile retrieved successfully.",
      data: formattedProfile
    });
  }
);
var updateTeacherProfileImage = catchAsync(
  async (req, res) => {
    const userId = req.user.id;
    const { imageUrl } = req.body;
    const updatedUser = await updateTeacherProfileImageService(
      userId,
      imageUrl
    );
    res.status(200).json({
      success: true,
      message: "Teacher profile image updated successfully.",
      data: updatedUser
    });
  }
);
var updateProfile2 = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const updatedProfile = await updateTeacherProfileData(
    userId,
    req.body
  );
  if (!updatedProfile) {
    throw new AppError("Failed to retrieve updated profile.", 500);
  }
  const formattedProfile = {
    id: updatedProfile.id,
    name: updatedProfile.name,
    email: updatedProfile.email,
    image: updatedProfile.image,
    phoneNumber: updatedProfile.phoneNumber,
    bloodGroup: updatedProfile.bloodGroup,
    role: updatedProfile.role,
    ...updatedProfile.teacherProfile
  };
  res.status(200).json({
    success: true,
    message: "Teacher profile updated successfully.",
    data: formattedProfile
  });
});

// src/middleware/teacher.middleware.ts
var requireTeacher = (req, res, next) => {
  if (!req.user || req.user.role !== "TEACHER") {
    return next(new AppError("Forbidden. Teacher access required.", 403));
  }
  next();
};

// src/modules/teacher/teacher.routes.ts
var router2 = Router2();
router2.post(
  "/register",
  requireAuth,
  requireAdmin,
  validateRequest(registerTeacherSchema),
  registerTeacher
);
router2.get("/profile", requireAuth, requireTeacher, getTeacherProfile);
router2.patch(
  "/profile/image",
  requireAuth,
  requireTeacher,
  validateRequest(updateTeacherImageSchema),
  updateTeacherProfileImage
);
router2.patch(
  "/profile",
  requireAuth,
  requireTeacher,
  validateRequest(updateTeacherProfileSchema),
  updateProfile2
);
var teacherRoutes = router2;

// src/modules/calendar/calendar.routes.ts
import { Router as Router3 } from "express";

// src/modules/calendar/calendar.schema.ts
import { z as z4 } from "zod";
var eventCategoryEnum = z4.enum([
  "CLASS",
  "REGISTRATION",
  "DEADLINE",
  "EXAM",
  "HOLIDAY",
  "MAKEUP_CLASS",
  "RESULT",
  "ACADEMIC",
  "OTHER"
]);
var calendarStatusEnum = z4.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);
var dateStringSchema = z4.string().refine(
  (val) => {
    const trimmed = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return true;
    const d = new Date(trimmed);
    return !isNaN(d.getTime());
  },
  { message: "Date must be in YYYY-MM-DD format (e.g. 2026-08-22)" }
);
var calendarEventInputSchema = z4.object({
  title: z4.string().min(1, "Event title is required"),
  description: z4.string().nullable().optional(),
  category: eventCategoryEnum.default("ACADEMIC"),
  startDate: dateStringSchema,
  endDate: dateStringSchema.nullable().optional(),
  weekNumber: z4.number().int().positive().nullable().optional(),
  isHoliday: z4.boolean().default(false),
  isAllDay: z4.boolean().default(true),
  remarks: z4.string().nullable().optional()
});
var updateEventInputSchema = z4.object({
  title: z4.string().min(1, "Event title is required").optional(),
  description: z4.string().nullable().optional(),
  category: eventCategoryEnum.optional(),
  startDate: dateStringSchema.optional(),
  endDate: dateStringSchema.nullable().optional(),
  weekNumber: z4.number().int().positive().nullable().optional(),
  isHoliday: z4.boolean().optional(),
  isAllDay: z4.boolean().optional(),
  remarks: z4.string().nullable().optional()
});
var createCalendarSchema = z4.object({
  body: z4.object({
    title: z4.string().min(1, "Calendar title is required"),
    semester: z4.string().min(1, "Semester is required (e.g. Winter 2026)"),
    academicYear: z4.coerce.number().int().min(2e3).max(2100).default(2026),
    isGlobal: z4.boolean().default(false),
    targetFaculties: z4.array(z4.string()).default([]),
    targetDepartments: z4.array(z4.string()).default([]),
    status: calendarStatusEnum.default("DRAFT").optional(),
    events: z4.array(calendarEventInputSchema).optional().default([])
  })
});
var updateCalendarSchema = z4.object({
  body: z4.object({
    title: z4.string().min(1, "Calendar title is required").optional(),
    semester: z4.string().min(1, "Semester is required").optional(),
    academicYear: z4.coerce.number().int().min(2e3).max(2100).optional(),
    isGlobal: z4.boolean().optional(),
    targetFaculties: z4.array(z4.string()).optional(),
    targetDepartments: z4.array(z4.string()).optional(),
    isActive: z4.boolean().optional()
  })
});
var updateCalendarStatusSchema = z4.object({
  body: z4.object({
    status: calendarStatusEnum
  })
});
var createSingleEventSchema = z4.object({
  body: calendarEventInputSchema
});
var updateSingleEventSchema = z4.object({
  body: updateEventInputSchema
});
var validateCsvSchema = z4.object({
  body: z4.object({
    csvContent: z4.string().min(1, "CSV content is required"),
    calendarId: z4.string().uuid().optional()
  })
});
var importCsvSchema = z4.object({
  body: z4.object({
    csvContent: z4.string().min(1, "CSV content is required")
  })
});

// src/modules/calendar/calendar.repository.ts
function toUtcDate(dateStr) {
  if (dateStr instanceof Date) return dateStr;
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    return new Date(Date.UTC(year, month - 1, day));
  }
  return new Date(dateStr);
}
var findUserWithAcademicProfiles = async (userId) => {
  return await prisma.user.findUnique({
    where: { id: userId },
    include: {
      studentProfile: true,
      teacherProfile: true
    }
  });
};
var findAllCalendarsAdmin = async (statusFilter) => {
  return await prisma.academicCalendar.findMany({
    where: statusFilter ? { status: statusFilter } : void 0,
    include: {
      events: {
        orderBy: { startDate: "asc" }
      },
      _count: {
        select: { events: true }
      }
    },
    orderBy: { createdAt: "desc" }
  });
};
var findCalendarById = async (id) => {
  return await prisma.academicCalendar.findUnique({
    where: { id },
    include: {
      events: {
        orderBy: { startDate: "asc" }
      }
    }
  });
};
var createAcademicCalendar = async (data, userId) => {
  return await prisma.academicCalendar.create({
    data: {
      title: data.title,
      semester: data.semester,
      academicYear: data.academicYear || 2026,
      status: data.status || "DRAFT",
      isActive: true,
      isGlobal: data.isGlobal ?? false,
      targetFaculties: data.targetFaculties || [],
      targetDepartments: data.targetDepartments || [],
      createdBy: userId || null,
      publishedAt: data.status === "PUBLISHED" ? /* @__PURE__ */ new Date() : null,
      events: {
        create: (data.events || []).map((event) => ({
          title: event.title,
          description: event.description || null,
          category: event.category || "ACADEMIC",
          startDate: toUtcDate(event.startDate),
          endDate: event.endDate ? toUtcDate(event.endDate) : null,
          weekNumber: event.weekNumber || null,
          isHoliday: event.isHoliday || false,
          isAllDay: event.isAllDay !== false,
          remarks: event.remarks || null
        }))
      }
    },
    include: {
      events: {
        orderBy: { startDate: "asc" }
      }
    }
  });
};
var updateAcademicCalendar = async (id, data, userId) => {
  return await prisma.academicCalendar.update({
    where: { id },
    data: {
      ...data.title !== void 0 && { title: data.title },
      ...data.semester !== void 0 && { semester: data.semester },
      ...data.academicYear !== void 0 && { academicYear: data.academicYear },
      ...data.isGlobal !== void 0 && { isGlobal: data.isGlobal },
      ...data.targetFaculties !== void 0 && {
        targetFaculties: data.targetFaculties
      },
      ...data.targetDepartments !== void 0 && {
        targetDepartments: data.targetDepartments
      },
      ...data.isActive !== void 0 && { isActive: data.isActive },
      updatedBy: userId || null
    },
    include: {
      events: {
        orderBy: { startDate: "asc" }
      }
    }
  });
};
var updateCalendarStatus = async (id, status, userId) => {
  const isPublished = status === "PUBLISHED";
  return await prisma.academicCalendar.update({
    where: { id },
    data: {
      status,
      ...isPublished && { publishedAt: /* @__PURE__ */ new Date() },
      updatedBy: userId || null
    },
    include: {
      events: {
        orderBy: { startDate: "asc" }
      }
    }
  });
};
var deleteAcademicCalendar = async (id) => {
  return await prisma.academicCalendar.delete({
    where: { id }
  });
};
var createCalendarEvent = async (calendarId, event) => {
  return await prisma.calendarEvent.create({
    data: {
      calendarId,
      title: event.title,
      description: event.description || null,
      category: event.category || "ACADEMIC",
      startDate: toUtcDate(event.startDate),
      endDate: event.endDate ? toUtcDate(event.endDate) : null,
      weekNumber: event.weekNumber || null,
      isHoliday: event.isHoliday || false,
      isAllDay: event.isAllDay !== false,
      remarks: event.remarks || null
    }
  });
};
var updateCalendarEvent = async (eventId, data) => {
  return await prisma.calendarEvent.update({
    where: { id: eventId },
    data: {
      ...data.title !== void 0 && { title: data.title },
      ...data.description !== void 0 && { description: data.description },
      ...data.category !== void 0 && {
        category: data.category
      },
      ...data.startDate !== void 0 && {
        startDate: toUtcDate(data.startDate)
      },
      ...data.endDate !== void 0 && {
        endDate: data.endDate ? toUtcDate(data.endDate) : null
      },
      ...data.weekNumber !== void 0 && { weekNumber: data.weekNumber },
      ...data.isHoliday !== void 0 && { isHoliday: data.isHoliday },
      ...data.isAllDay !== void 0 && { isAllDay: data.isAllDay },
      ...data.remarks !== void 0 && { remarks: data.remarks }
    }
  });
};
var deleteCalendarEvent = async (eventId) => {
  return await prisma.calendarEvent.delete({
    where: { id: eventId }
  });
};
var replaceCalendarEventsTransaction = async (calendarId, events, userId) => {
  return await prisma.$transaction(async (tx) => {
    await tx.calendarEvent.deleteMany({
      where: { calendarId }
    });
    if (events.length > 0) {
      await tx.calendarEvent.createMany({
        data: events.map((ev) => ({
          calendarId,
          title: ev.title,
          description: ev.description || null,
          category: ev.category,
          startDate: toUtcDate(ev.startDate),
          endDate: ev.endDate ? toUtcDate(ev.endDate) : null,
          weekNumber: ev.weekNumber || null,
          isHoliday: ev.isHoliday,
          isAllDay: ev.isAllDay,
          remarks: ev.remarks || null
        }))
      });
    }
    return await tx.academicCalendar.update({
      where: { id: calendarId },
      data: {
        updatedBy: userId || null
      },
      include: {
        events: {
          orderBy: { startDate: "asc" }
        }
      }
    });
  });
};
var findActiveCalendarsFiltered = async (orConditions) => {
  return await prisma.academicCalendar.findMany({
    where: {
      status: "PUBLISHED",
      isActive: true,
      OR: orConditions
    },
    include: {
      events: {
        orderBy: { startDate: "asc" }
      }
    },
    orderBy: { createdAt: "desc" }
  });
};
var findCurrentPublishedCalendar = async (orConditions) => {
  return await prisma.academicCalendar.findFirst({
    where: {
      status: "PUBLISHED",
      isActive: true,
      OR: orConditions
    },
    include: {
      events: {
        orderBy: { startDate: "asc" }
      }
    },
    orderBy: { createdAt: "desc" }
  });
};
var duplicateAcademicCalendar = async (calendarId, userId) => {
  const original = await prisma.academicCalendar.findUnique({
    where: { id: calendarId },
    include: {
      events: {
        orderBy: { startDate: "asc" }
      }
    }
  });
  if (!original) return null;
  return await prisma.academicCalendar.create({
    data: {
      title: `${original.title} (Copy)`,
      semester: `${original.semester} (Copy)`,
      academicYear: original.academicYear,
      status: "DRAFT",
      isActive: true,
      isGlobal: original.isGlobal,
      targetFaculties: original.targetFaculties,
      targetDepartments: original.targetDepartments,
      createdBy: userId || null,
      events: {
        create: original.events.map((ev) => ({
          title: ev.title,
          description: ev.description,
          category: ev.category,
          startDate: ev.startDate,
          endDate: ev.endDate,
          weekNumber: ev.weekNumber,
          isHoliday: ev.isHoliday,
          isAllDay: ev.isAllDay,
          remarks: ev.remarks
        }))
      }
    },
    include: {
      events: {
        orderBy: { startDate: "asc" }
      }
    }
  });
};

// src/modules/calendar/calendar.csv.ts
var VALID_EVENT_CATEGORIES = [
  "CLASS",
  "REGISTRATION",
  "DEADLINE",
  "EXAM",
  "HOLIDAY",
  "MAKEUP_CLASS",
  "RESULT",
  "ACADEMIC",
  "OTHER"
];
var CSV_CANONICAL_HEADERS = [
  "title",
  "description",
  "category",
  "startDate",
  "endDate",
  "weekNumber",
  "isHoliday",
  "isAllDay",
  "remarks"
];
function parseCsvTokens(csvText) {
  let text = csvText.replace(/^\uFEFF/, "");
  const rows = [];
  let currentRow = [];
  let currentField = "";
  let insideQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    if (insideQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentField += '"';
          i++;
        } else {
          insideQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
      } else if (char === ",") {
        currentRow.push(currentField);
        currentField = "";
      } else if (char === "\r") {
        if (nextChar === "\n") {
          i++;
        }
        currentRow.push(currentField);
        currentField = "";
        rows.push(currentRow);
        currentRow = [];
      } else if (char === "\n") {
        currentRow.push(currentField);
        currentField = "";
        rows.push(currentRow);
        currentRow = [];
      } else {
        currentField += char;
      }
    }
  }
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }
  return rows.filter(
    (row) => row.some((cell) => cell.trim().length > 0)
  );
}
function validateIsoDateString(dateStr) {
  const trimmed = dateStr.trim();
  const isoRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
  const match = trimmed.match(isoRegex);
  if (!match) {
    return {
      valid: false,
      error: `Invalid date format "${dateStr}". Strict format required: YYYY-MM-DD (e.g. 2026-08-22). Ambiguous formats like DD/MM/YYYY are not allowed.`
    };
  }
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  if (month < 1 || month > 12) {
    return { valid: false, error: `Invalid month "${month}" in date "${dateStr}".` };
  }
  const dateObj = new Date(Date.UTC(year, month - 1, day));
  if (dateObj.getUTCFullYear() !== year || dateObj.getUTCMonth() !== month - 1 || dateObj.getUTCDate() !== day) {
    return { valid: false, error: `Calendar date "${dateStr}" does not exist.` };
  }
  return { valid: true, formatted: trimmed };
}
function parseBooleanValue(value, defaultValue) {
  if (value === void 0 || value === null || value.trim() === "") {
    return { valid: true, value: defaultValue };
  }
  const lower = value.trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(lower)) {
    return { valid: true, value: true };
  }
  if (["false", "0", "no", "n"].includes(lower)) {
    return { valid: true, value: false };
  }
  return {
    valid: false,
    value: defaultValue,
    error: `Invalid boolean value "${value}". Allowed: true, false, yes, no, 1, 0.`
  };
}
function normalizeCategory(categoryStr) {
  if (!categoryStr || categoryStr.trim() === "") {
    return { valid: true, category: "ACADEMIC" };
  }
  const upper = categoryStr.trim().toUpperCase().replace(/[-\s]/g, "_");
  const aliases = {
    CLASS: "CLASS",
    CLASSES: "CLASS",
    REGULAR_CLASS: "CLASS",
    REGISTRATION: "REGISTRATION",
    SEMESTER_REGISTRATION: "REGISTRATION",
    DEADLINE: "DEADLINE",
    DUE_DATE: "DEADLINE",
    PAYMENT_DEADLINE: "DEADLINE",
    EXAM: "EXAM",
    EXAMINATION: "EXAM",
    MIDTERM: "EXAM",
    FINAL_EXAM: "EXAM",
    HOLIDAY: "HOLIDAY",
    VACATION: "HOLIDAY",
    MAKEUP_CLASS: "MAKEUP_CLASS",
    MAKEUP: "MAKEUP_CLASS",
    RESULT: "RESULT",
    RESULT_PUBLICATION: "RESULT",
    ACADEMIC: "ACADEMIC",
    OTHER: "OTHER"
  };
  if (aliases[upper]) {
    return { valid: true, category: aliases[upper] };
  }
  return {
    valid: false,
    category: "ACADEMIC",
    error: `Unknown category "${categoryStr}". Allowed categories: ${VALID_EVENT_CATEGORIES.join(", ")}.`
  };
}
function validateAndParseCsv(csvContent, existingEvents) {
  const errors = [];
  const warnings = [];
  const parsedEvents = [];
  const rawRows = parseCsvTokens(csvContent);
  if (rawRows.length === 0) {
    return {
      isValid: false,
      totalRows: 0,
      validRowsCount: 0,
      errorCount: 1,
      warningCount: 0,
      errors: [
        {
          rowNumber: 1,
          field: "file",
          message: "The provided CSV file is empty or could not be read."
        }
      ],
      warnings: [],
      parsedEvents: []
    };
  }
  const headerRow = rawRows[0].map((h) => h.trim().toLowerCase());
  const headerMap = {};
  headerRow.forEach((header, index) => {
    const cleanHeader = header.replace(/[_\s-]/g, "");
    headerMap[cleanHeader] = index;
  });
  if (!("title" in headerMap)) {
    errors.push({
      rowNumber: 1,
      field: "headers",
      message: 'Missing required header "title".'
    });
  }
  if (!("startdate" in headerMap)) {
    errors.push({
      rowNumber: 1,
      field: "headers",
      message: 'Missing required header "startDate".'
    });
  }
  if (errors.length > 0) {
    return {
      isValid: false,
      totalRows: rawRows.length - 1,
      validRowsCount: 0,
      errorCount: errors.length,
      warningCount: 0,
      errors,
      warnings,
      parsedEvents: []
    };
  }
  const getCell = (row, colName) => {
    const idx = headerMap[colName.toLowerCase().replace(/[_\s-]/g, "")];
    return idx !== void 0 && idx < row.length ? row[idx].trim() : "";
  };
  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    const rowNumber = i + 1;
    const rawTitle = getCell(row, "title");
    const rawDescription = getCell(row, "description");
    const rawCategory = getCell(row, "category");
    const rawStartDate = getCell(row, "startDate");
    const rawEndDate = getCell(row, "endDate");
    const rawWeekNumber = getCell(row, "weekNumber");
    const rawIsHoliday = getCell(row, "isHoliday");
    const rawIsAllDay = getCell(row, "isAllDay");
    const rawRemarks = getCell(row, "remarks");
    let rowHasError = false;
    if (!rawTitle) {
      errors.push({
        rowNumber,
        field: "title",
        message: 'Missing required field "title".'
      });
      rowHasError = true;
    }
    if (!rawStartDate) {
      errors.push({
        rowNumber,
        field: "startDate",
        message: 'Missing required field "startDate". Expected format: YYYY-MM-DD.'
      });
      rowHasError = true;
    }
    const startDateValidation = validateIsoDateString(rawStartDate);
    if (!startDateValidation.valid) {
      errors.push({
        rowNumber,
        field: "startDate",
        message: startDateValidation.error || "Invalid startDate.",
        rawValue: rawStartDate
      });
      rowHasError = true;
    }
    let validatedEndDate = null;
    if (rawEndDate) {
      const endDateValidation = validateIsoDateString(rawEndDate);
      if (!endDateValidation.valid) {
        errors.push({
          rowNumber,
          field: "endDate",
          message: endDateValidation.error || "Invalid endDate.",
          rawValue: rawEndDate
        });
        rowHasError = true;
      } else {
        validatedEndDate = endDateValidation.formatted || null;
        if (startDateValidation.valid && validatedEndDate && validatedEndDate < (startDateValidation.formatted || "")) {
          errors.push({
            rowNumber,
            field: "endDate",
            message: `endDate "${validatedEndDate}" cannot be earlier than startDate "${startDateValidation.formatted}".`
          });
          rowHasError = true;
        }
      }
    }
    const categoryValidation = normalizeCategory(rawCategory);
    if (!categoryValidation.valid) {
      errors.push({
        rowNumber,
        field: "category",
        message: categoryValidation.error || "Invalid category.",
        rawValue: rawCategory
      });
      rowHasError = true;
    }
    let parsedWeekNumber = null;
    if (rawWeekNumber) {
      const parsed = parseInt(rawWeekNumber, 10);
      if (isNaN(parsed) || parsed <= 0 || parsed > 52) {
        warnings.push({
          rowNumber,
          field: "weekNumber",
          message: `Unusual or invalid weekNumber "${rawWeekNumber}". Must be an integer between 1 and 52.`
        });
      } else {
        parsedWeekNumber = parsed;
      }
    }
    const isHolidayValidation = parseBooleanValue(rawIsHoliday, false);
    if (!isHolidayValidation.valid) {
      warnings.push({
        rowNumber,
        field: "isHoliday",
        message: isHolidayValidation.error || "Invalid isHoliday value, defaulting to false."
      });
    }
    const isAllDayValidation = parseBooleanValue(rawIsAllDay, true);
    if (!isAllDayValidation.valid) {
      warnings.push({
        rowNumber,
        field: "isAllDay",
        message: isAllDayValidation.error || "Invalid isAllDay value, defaulting to true."
      });
    }
    if (!rowHasError) {
      parsedEvents.push({
        rowNumber,
        title: rawTitle,
        description: rawDescription || null,
        category: categoryValidation.category,
        startDate: startDateValidation.formatted,
        endDate: validatedEndDate,
        weekNumber: parsedWeekNumber,
        isHoliday: isHolidayValidation.value,
        isAllDay: isAllDayValidation.value,
        remarks: rawRemarks || null
      });
    }
  }
  let diffSummary = void 0;
  if (existingEvents) {
    const diffs = [];
    let newCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;
    const formatDateStr = (d) => {
      if (!d) return "";
      if (typeof d === "string") return d.split("T")[0];
      return d.toISOString().split("T")[0];
    };
    for (const newEv of parsedEvents) {
      const match = existingEvents.find(
        (ex) => ex.title.trim().toLowerCase() === newEv.title.trim().toLowerCase() && formatDateStr(ex.startDate) === newEv.startDate
      );
      if (!match) {
        newCount++;
        diffs.push({
          status: "NEW",
          title: newEv.title,
          category: newEv.category,
          startDate: newEv.startDate,
          endDate: newEv.endDate,
          details: "New event to be created"
        });
      } else {
        const matchEnd = formatDateStr(match.endDate);
        const matchCat = match.category;
        const matchRem = match.remarks || "";
        const hasChanged = matchEnd !== (newEv.endDate || "") || matchCat !== newEv.category || matchRem !== (newEv.remarks || "") || (match.weekNumber ?? null) !== (newEv.weekNumber ?? null) || !!match.isHoliday !== newEv.isHoliday;
        if (hasChanged) {
          updatedCount++;
          diffs.push({
            status: "UPDATED",
            title: newEv.title,
            category: newEv.category,
            startDate: newEv.startDate,
            endDate: newEv.endDate,
            details: "Updated dates/category/remarks"
          });
        } else {
          unchangedCount++;
          diffs.push({
            status: "UNCHANGED",
            title: newEv.title,
            category: newEv.category,
            startDate: newEv.startDate,
            endDate: newEv.endDate,
            details: "Identical to existing event"
          });
        }
      }
    }
    diffSummary = {
      newCount,
      updatedCount,
      unchangedCount,
      diffs
    };
  }
  const totalDataRows = rawRows.length - 1;
  const isValid = errors.length === 0 && parsedEvents.length > 0;
  return {
    isValid,
    totalRows: totalDataRows,
    validRowsCount: parsedEvents.length,
    errorCount: errors.length,
    warningCount: warnings.length,
    errors,
    warnings,
    parsedEvents,
    diffSummary
  };
}
function escapeCsvCell(value) {
  if (value === null || value === void 0) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
function generateCsvFromEvents(events) {
  const formatDateStr = (d) => {
    if (!d) return "";
    if (typeof d === "string") return d.split("T")[0];
    return d.toISOString().split("T")[0];
  };
  const headerLine = CSV_CANONICAL_HEADERS.join(",");
  const lines = events.map((ev) => {
    const row = [
      escapeCsvCell(ev.title),
      escapeCsvCell(ev.description || ""),
      escapeCsvCell(ev.category),
      escapeCsvCell(formatDateStr(ev.startDate)),
      escapeCsvCell(formatDateStr(ev.endDate)),
      escapeCsvCell(ev.weekNumber ?? ""),
      escapeCsvCell(ev.isHoliday ? "true" : "false"),
      escapeCsvCell(ev.isAllDay !== false ? "true" : "false"),
      escapeCsvCell(ev.remarks || "")
    ];
    return row.join(",");
  });
  return [headerLine, ...lines].join("\r\n");
}
function generateCsvTemplate() {
  const headerLine = CSV_CANONICAL_HEADERS.join(",");
  const sampleRows = [
    [
      "Classes will start",
      "Classes will start from 22.08.2026 (Saturday)",
      "CLASS",
      "2026-08-22",
      "",
      "1",
      "false",
      "true",
      ""
    ].join(","),
    [
      "Sem. Registration Week",
      "Semester Registration Week",
      "REGISTRATION",
      "2026-08-22",
      "2026-08-28",
      "1",
      "false",
      "true",
      ""
    ].join(","),
    [
      "Last Date for Semester Registration",
      "Last Date for Semester Registration and Retake",
      "DEADLINE",
      "2026-09-03",
      "",
      "2",
      "false",
      "true",
      ""
    ].join(","),
    [
      "Mid-term Examination",
      "Offline Mode",
      "EXAM",
      "2026-09-30",
      "2026-10-15",
      "8",
      "false",
      "true",
      "Offline Mode"
    ].join(","),
    [
      "National Holiday",
      "University Closed",
      "HOLIDAY",
      "2026-10-21",
      "",
      "11",
      "true",
      "true",
      "University Holiday"
    ].join(",")
  ];
  return [headerLine, ...sampleRows].join("\r\n");
}

// src/modules/calendar/calendar.service.ts
var getAdminCalendarsService = async (status) => {
  return await findAllCalendarsAdmin(status);
};
var getCalendarByIdService = async (id, user) => {
  const calendar = await findCalendarById(id);
  if (!calendar) {
    throw new AppError("Academic calendar not found.", 404);
  }
  if (user.role !== "ADMIN" && calendar.status !== "PUBLISHED") {
    throw new AppError(
      "Access denied. This calendar is currently in draft mode.",
      403
    );
  }
  return calendar;
};
var createCalendarService = async (data, userId) => {
  return await createAcademicCalendar(data, userId);
};
var updateCalendarService = async (id, data, userId) => {
  const existing = await findCalendarById(id);
  if (!existing) {
    throw new AppError("Academic calendar not found.", 404);
  }
  return await updateAcademicCalendar(id, data, userId);
};
var updateCalendarStatusService = async (id, status, userId) => {
  const existing = await findCalendarById(id);
  if (!existing) {
    throw new AppError("Academic calendar not found.", 404);
  }
  if (status === "PUBLISHED" && (!existing.events || existing.events.length === 0)) {
    throw new AppError(
      "Cannot publish an academic calendar without any events. Please import or add events first.",
      400
    );
  }
  return await updateCalendarStatus(id, status, userId);
};
var duplicateCalendarService = async (calendarId, userId) => {
  const existing = await findCalendarById(calendarId);
  if (!existing) {
    throw new AppError("Source academic calendar not found.", 404);
  }
  return await duplicateAcademicCalendar(calendarId, userId);
};
var deleteCalendarService = async (id) => {
  const existing = await findCalendarById(id);
  if (!existing) {
    throw new AppError("Academic calendar not found.", 404);
  }
  return await deleteAcademicCalendar(id);
};
var addEventService = async (calendarId, eventData) => {
  const calendar = await findCalendarById(calendarId);
  if (!calendar) {
    throw new AppError("Academic calendar not found.", 404);
  }
  return await createCalendarEvent(calendarId, eventData);
};
var updateEventService = async (calendarId, eventId, eventData) => {
  const calendar = await findCalendarById(calendarId);
  if (!calendar) {
    throw new AppError("Academic calendar not found.", 404);
  }
  const event = calendar.events.find((e) => e.id === eventId);
  if (!event) {
    throw new AppError("Event not found in this calendar.", 404);
  }
  return await updateCalendarEvent(eventId, eventData);
};
var deleteEventService = async (calendarId, eventId) => {
  const calendar = await findCalendarById(calendarId);
  if (!calendar) {
    throw new AppError("Academic calendar not found.", 404);
  }
  const event = calendar.events.find((e) => e.id === eventId);
  if (!event) {
    throw new AppError("Event not found in this calendar.", 404);
  }
  return await deleteCalendarEvent(eventId);
};
var validateCsvService = async (csvContent, calendarId) => {
  let existingEvents = void 0;
  if (calendarId) {
    const calendar = await findCalendarById(calendarId);
    if (calendar) {
      existingEvents = calendar.events;
    }
  }
  return validateAndParseCsv(csvContent, existingEvents);
};
var importCsvService = async (calendarId, csvContent, userId) => {
  const calendar = await findCalendarById(calendarId);
  if (!calendar) {
    throw new AppError("Academic calendar not found.", 404);
  }
  const validation = validateAndParseCsv(csvContent, calendar.events);
  if (!validation.isValid) {
    const firstError = validation.errors[0];
    throw new AppError(
      `CSV validation failed at Row ${firstError.rowNumber} (${firstError.field}): ${firstError.message}`,
      422
    );
  }
  const updatedCalendar = await replaceCalendarEventsTransaction(
    calendarId,
    validation.parsedEvents,
    userId
  );
  return {
    calendar: updatedCalendar,
    importedCount: validation.parsedEvents.length,
    warnings: validation.warnings
  };
};
var exportCsvService = async (calendarId) => {
  const calendar = await findCalendarById(calendarId);
  if (!calendar) {
    throw new AppError("Academic calendar not found.", 404);
  }
  return generateCsvFromEvents(calendar.events);
};
var getCsvTemplateService = () => {
  return generateCsvTemplate();
};
var buildUserAudienceConditions = async (userId) => {
  const user = await findUserWithAcademicProfiles(userId);
  if (!user) {
    throw new AppError("User account not found.", 404);
  }
  let userFaculty = null;
  let userDepartment = null;
  if (user.studentProfile) {
    userFaculty = user.studentProfile.faculty || null;
    userDepartment = user.studentProfile.department;
  } else if (user.teacherProfile) {
    userFaculty = user.teacherProfile.faculty || null;
    userDepartment = user.teacherProfile.department;
  }
  const orConditions = [{ isGlobal: true }];
  if (userFaculty) {
    orConditions.push({ targetFaculties: { has: userFaculty } });
    orConditions.push({ targetFaculties: { has: userFaculty.toUpperCase() } });
  }
  if (userDepartment) {
    orConditions.push({ targetDepartments: { has: userDepartment } });
    orConditions.push({
      targetDepartments: { has: userDepartment.toUpperCase() }
    });
  }
  return { user, orConditions };
};
var getRelevantCalendarsService = async (userId) => {
  const { user, orConditions } = await buildUserAudienceConditions(userId);
  if (user.role === "ADMIN") {
    return await findAllCalendarsAdmin();
  }
  return await findActiveCalendarsFiltered(orConditions);
};
var getCurrentPublishedCalendarService = async (userId) => {
  const { user, orConditions } = await buildUserAudienceConditions(userId);
  if (user.role === "ADMIN") {
    const adminCalendars = await findAllCalendarsAdmin();
    return adminCalendars.find((c) => c.status === "PUBLISHED") || adminCalendars[0] || null;
  }
  const current = await findCurrentPublishedCalendar(orConditions);
  if (!current) {
    throw new AppError(
      "No published academic calendar found for your department.",
      404
    );
  }
  return current;
};
var getUpcomingEventsService = async (userId) => {
  const { user, orConditions } = await buildUserAudienceConditions(userId);
  const calendars = user.role === "ADMIN" ? await findAllCalendarsAdmin() : await findActiveCalendarsFiltered(orConditions);
  const activeCalendar = calendars[0];
  if (!activeCalendar) {
    return [];
  }
  const today = /* @__PURE__ */ new Date();
  today.setUTCHours(0, 0, 0, 0);
  return activeCalendar.events.filter((ev) => {
    const targetDate = ev.endDate ? new Date(ev.endDate) : new Date(ev.startDate);
    targetDate.setUTCHours(23, 59, 59, 999);
    return targetDate >= today;
  });
};

// src/modules/calendar/calendar.controller.ts
var getCalendars = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const relevantCalendars = await getRelevantCalendarsService(userId);
  res.status(200).json({
    success: true,
    message: "Relevant academic calendars retrieved successfully.",
    data: relevantCalendars
  });
});
var getCurrentCalendar = catchAsync(
  async (req, res) => {
    const userId = req.user.id;
    const calendar = await getCurrentPublishedCalendarService(userId);
    res.status(200).json({
      success: true,
      message: "Current published academic calendar retrieved successfully.",
      data: calendar
    });
  }
);
var getUpcomingEvents = catchAsync(
  async (req, res) => {
    const userId = req.user.id;
    const events = await getUpcomingEventsService(userId);
    res.status(200).json({
      success: true,
      message: "Upcoming academic events retrieved successfully.",
      data: events
    });
  }
);
var getCalendarById = catchAsync(
  async (req, res) => {
    const calendarId = req.params.id;
    const user = req.user;
    const calendar = await getCalendarByIdService(
      calendarId,
      user
    );
    res.status(200).json({
      success: true,
      message: "Academic calendar retrieved successfully.",
      data: calendar
    });
  }
);
var getAdminCalendars = catchAsync(
  async (req, res) => {
    const status = req.query.status;
    const calendars = await getAdminCalendarsService(status);
    res.status(200).json({
      success: true,
      message: "All academic calendars retrieved successfully.",
      data: calendars
    });
  }
);
var createCalendar = catchAsync(
  async (req, res) => {
    const userId = req.user.id;
    const newCalendar = await createCalendarService(
      req.body,
      userId
    );
    res.status(201).json({
      success: true,
      message: "Academic Calendar created successfully.",
      data: newCalendar
    });
  }
);
var updateCalendar = catchAsync(
  async (req, res) => {
    const calendarId = req.params.id;
    const userId = req.user.id;
    const updated = await updateCalendarService(
      calendarId,
      req.body,
      userId
    );
    res.status(200).json({
      success: true,
      message: "Academic Calendar metadata updated successfully.",
      data: updated
    });
  }
);
var updateCalendarStatus2 = catchAsync(
  async (req, res) => {
    const calendarId = req.params.id;
    const status = req.body.status;
    const userId = req.user.id;
    const updated = await updateCalendarStatusService(
      calendarId,
      status,
      userId
    );
    res.status(200).json({
      success: true,
      message: `Academic Calendar status changed to ${status}.`,
      data: updated
    });
  }
);
var duplicateCalendar = catchAsync(
  async (req, res) => {
    const calendarId = req.params.id;
    const userId = req.user.id;
    const duplicated = await duplicateCalendarService(
      calendarId,
      userId
    );
    res.status(201).json({
      success: true,
      message: "Academic Calendar duplicated successfully into Draft.",
      data: duplicated
    });
  }
);
var deleteCalendar = catchAsync(
  async (req, res) => {
    const calendarId = req.params.id;
    await deleteCalendarService(calendarId);
    res.status(200).json({
      success: true,
      message: "Academic Calendar deleted successfully."
    });
  }
);
var addEvent = catchAsync(async (req, res) => {
  const calendarId = req.params.id;
  const event = await addEventService(calendarId, req.body);
  res.status(201).json({
    success: true,
    message: "Event added to calendar successfully.",
    data: event
  });
});
var updateEvent = catchAsync(async (req, res) => {
  const calendarId = req.params.id;
  const eventId = req.params.eventId;
  const updated = await updateEventService(
    calendarId,
    eventId,
    req.body
  );
  res.status(200).json({
    success: true,
    message: "Event updated successfully.",
    data: updated
  });
});
var deleteEvent = catchAsync(async (req, res) => {
  const calendarId = req.params.id;
  const eventId = req.params.eventId;
  await deleteEventService(calendarId, eventId);
  res.status(200).json({
    success: true,
    message: "Event deleted successfully."
  });
});
var validateCsv = catchAsync(async (req, res) => {
  const { csvContent, calendarId } = req.body;
  const validationResult = await validateCsvService(
    csvContent,
    calendarId
  );
  res.status(200).json({
    success: true,
    message: validationResult.isValid ? "CSV validated successfully." : "CSV contains validation errors.",
    data: validationResult
  });
});
var importCsv = catchAsync(async (req, res) => {
  const calendarId = req.params.id;
  const { csvContent } = req.body;
  const userId = req.user.id;
  const result = await importCsvService(
    calendarId,
    csvContent,
    userId
  );
  res.status(200).json({
    success: true,
    message: `Successfully imported ${result.importedCount} events into calendar.`,
    data: result
  });
});
var exportCsv = catchAsync(async (req, res) => {
  const calendarId = req.params.id;
  const csvData = await exportCsvService(calendarId);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="academic-calendar-${calendarId}.csv"`
  );
  res.status(200).send(csvData);
});
var getCsvTemplate = catchAsync(
  async (_req, res) => {
    const templateData = getCsvTemplateService();
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="academic-calendar-template.csv"'
    );
    res.status(200).send(templateData);
  }
);

// src/modules/calendar/calendar.routes.ts
var router3 = Router3();
router3.get("/template/csv", requireAuth, requireAdmin, getCsvTemplate);
router3.post(
  "/validate-csv",
  requireAuth,
  requireAdmin,
  validateRequest(validateCsvSchema),
  validateCsv
);
router3.get("/admin/all", requireAuth, requireAdmin, getAdminCalendars);
router3.get("/current", requireAuth, getCurrentCalendar);
router3.get("/events/upcoming", requireAuth, getUpcomingEvents);
router3.get("/", requireAuth, getCalendars);
router3.get("/:id", requireAuth, getCalendarById);
router3.post(
  "/",
  requireAuth,
  requireAdmin,
  validateRequest(createCalendarSchema),
  createCalendar
);
router3.put(
  "/:id",
  requireAuth,
  requireAdmin,
  validateRequest(updateCalendarSchema),
  updateCalendar
);
router3.patch(
  "/:id/status",
  requireAuth,
  requireAdmin,
  validateRequest(updateCalendarStatusSchema),
  updateCalendarStatus2
);
router3.post("/:id/duplicate", requireAuth, requireAdmin, duplicateCalendar);
router3.delete("/:id", requireAuth, requireAdmin, deleteCalendar);
router3.post(
  "/:id/events",
  requireAuth,
  requireAdmin,
  validateRequest(createSingleEventSchema),
  addEvent
);
router3.put(
  "/:id/events/:eventId",
  requireAuth,
  requireAdmin,
  validateRequest(updateSingleEventSchema),
  updateEvent
);
router3.delete("/:id/events/:eventId", requireAuth, requireAdmin, deleteEvent);
router3.post(
  "/:id/import-csv",
  requireAuth,
  requireAdmin,
  validateRequest(importCsvSchema),
  importCsv
);
router3.get("/:id/export-csv", requireAuth, requireAdmin, exportCsv);
var calendarRoutes = router3;

// src/modules/bus/bus.routes.ts
import { Router as Router4 } from "express";

// src/modules/bus/bus.schema.ts
import { z as z5 } from "zod";
var createBusSchema = z5.object({
  body: z5.object({
    route: z5.string().min(1, "Route name is required"),
    busNumber: z5.string().min(1, "Bus number is required"),
    departureTime: z5.string().min(1, "Departure time is required"),
    stops: z5.array(z5.string()).min(1, "At least one stop must be provided")
  })
});

// src/modules/bus/bus.repository.ts
var createBusRoute = async (data) => {
  return await prisma.busSchedule.create({
    data: {
      route: data.route,
      busNumber: data.busNumber,
      departureTime: data.departureTime,
      stops: data.stops
    }
  });
};
var findAllBusRoutes = async (take = 100) => {
  return await prisma.busSchedule.findMany({
    orderBy: {
      createdAt: "asc"
    },
    take
  });
};
var findBusRouteById = async (id) => {
  return await prisma.busSchedule.findUnique({
    where: { id }
  });
};
var deleteBusRouteById = async (id) => {
  return await prisma.busSchedule.delete({
    where: { id }
  });
};

// src/modules/bus/bus.service.ts
var createBusRouteService = async (data) => {
  return await createBusRoute(data);
};
var getAllBusRoutesService = async () => {
  return await findAllBusRoutes(100);
};
var deleteBusRouteService = async (id) => {
  const existingBusRoute = await findBusRouteById(id);
  if (!existingBusRoute) {
    throw new AppError("Bus route not found.", 404);
  }
  return await deleteBusRouteById(id);
};

// src/modules/bus/bus.controller.ts
var createBusRoute2 = catchAsync(
  async (req, res) => {
    const newBusRoute = await createBusRouteService(req.body);
    res.status(201).json({
      success: true,
      message: "Bus route created successfully.",
      data: newBusRoute
    });
  }
);
var getBusRoutes = catchAsync(async (req, res) => {
  const busRoutes2 = await getAllBusRoutesService();
  res.status(200).json({
    success: true,
    message: "Bus routes retrieved successfully.",
    data: busRoutes2
  });
});
var deleteBusRoute = catchAsync(
  async (req, res) => {
    const id = req.params.id;
    await deleteBusRouteService(id);
    res.status(200).json({
      success: true,
      message: "Bus route deleted successfully."
    });
  }
);

// src/modules/bus/bus.routes.ts
var router4 = Router4();
router4.post(
  "/",
  requireAuth,
  requireAdmin,
  validateRequest(createBusSchema),
  createBusRoute2
);
router4.get("/", requireAuth, getBusRoutes);
router4.delete("/:id", requireAuth, requireAdmin, deleteBusRoute);
var busRoutes = router4;

// src/modules/notice/notice.routes.ts
import { Router as Router5 } from "express";

// src/modules/notice/notice.schema.ts
import { z as z6 } from "zod";
var createNoticeSchema = z6.object({
  body: z6.object({
    referenceNo: z6.string().optional(),
    title: z6.string().min(1, "Title is required"),
    body: z6.string().min(1, "Body is required"),
    issuerName: z6.string().min(1, "Issuer name is required"),
    issuerDesignation: z6.string().min(1, "Issuer designation is required"),
    copyTo: z6.array(z6.string()).optional().default([])
  })
});

// src/modules/notice/notice.repository.ts
var createNotice = async (data) => {
  return await prisma.notice.create({
    data: {
      referenceNo: data.referenceNo,
      title: data.title,
      body: data.body,
      issuerName: data.issuerName,
      issuerDesignation: data.issuerDesignation,
      copyTo: data.copyTo || []
    }
  });
};
var findAllNotices = async (take = 100) => {
  return await prisma.notice.findMany({
    orderBy: {
      createdAt: "desc"
    },
    take
  });
};
var findNoticeById = async (id) => {
  return await prisma.notice.findUnique({
    where: { id }
  });
};
var deleteNoticeById = async (id) => {
  return await prisma.notice.delete({
    where: { id }
  });
};

// src/modules/notice/notice.service.ts
var createNoticeService = async (data) => {
  return await createNotice(data);
};
var getAllNoticesService = async () => {
  return await findAllNotices(100);
};
var getNoticeByIdService = async (id) => {
  const notice = await findNoticeById(id);
  if (!notice) {
    throw new AppError("Notice not found.", 404);
  }
  return notice;
};
var deleteNoticeService = async (id) => {
  const existingNotice = await findNoticeById(id);
  if (!existingNotice) {
    throw new AppError("Notice not found.", 404);
  }
  return await deleteNoticeById(id);
};

// src/modules/notice/notice.controller.ts
var createNotice2 = catchAsync(async (req, res) => {
  const newNotice = await createNoticeService(req.body);
  res.status(201).json({
    success: true,
    message: "Notice created successfully.",
    data: newNotice
  });
});
var getNotices = catchAsync(async (req, res) => {
  const notices = await getAllNoticesService();
  res.status(200).json({
    success: true,
    message: "Notices retrieved successfully.",
    data: notices
  });
});
var getNoticeById = catchAsync(async (req, res) => {
  const id = req.params.id;
  const notice = await getNoticeByIdService(id);
  res.status(200).json({
    success: true,
    message: "Notice retrieved successfully.",
    data: notice
  });
});
var deleteNotice = catchAsync(async (req, res) => {
  const id = req.params.id;
  await deleteNoticeService(id);
  res.status(200).json({
    success: true,
    message: "Notice deleted successfully."
  });
});

// src/modules/notice/notice.routes.ts
var router5 = Router5();
router5.post(
  "/",
  requireAuth,
  requireAdmin,
  validateRequest(createNoticeSchema),
  createNotice2
);
router5.get("/", requireAuth, getNotices);
router5.get("/:id", requireAuth, getNoticeById);
router5.delete("/:id", requireAuth, requireAdmin, deleteNotice);
var noticeRoutes = router5;

// src/modules/event/event.routes.ts
import { Router as Router6 } from "express";

// src/modules/event/event.schema.ts
import { z as z7 } from "zod";
var createEventSchema = z7.object({
  body: z7.object({
    title: z7.string().min(1, "Event title is required"),
    description: z7.string().optional(),
    location: z7.string().optional(),
    eventDate: z7.preprocess(
      (val) => {
        if (!val) return void 0;
        if (val instanceof Date) return val;
        return new Date(val);
      },
      z7.date({
        message: "Event date is required and must be a valid date"
      })
    )
  })
});

// src/modules/event/event.repository.ts
var createCampusEvent = async (data) => {
  return await prisma.campusEvent.create({
    data: {
      title: data.title,
      description: data.description,
      location: data.location,
      eventDate: data.eventDate
    }
  });
};
var findAllCampusEvents = async (take = 100) => {
  return await prisma.campusEvent.findMany({
    orderBy: {
      eventDate: "asc"
    },
    take
  });
};
var findCampusEventById = async (id) => {
  return await prisma.campusEvent.findUnique({
    where: { id }
  });
};
var deleteCampusEventById = async (id) => {
  return await prisma.campusEvent.delete({
    where: { id }
  });
};

// src/modules/event/event.service.ts
var createEventService = async (data) => {
  return await createCampusEvent(data);
};
var getAllEventsService = async () => {
  return await findAllCampusEvents(100);
};
var deleteEventService2 = async (id) => {
  const existingEvent = await findCampusEventById(id);
  if (!existingEvent) {
    throw new AppError("Campus event not found.", 404);
  }
  return await deleteCampusEventById(id);
};

// src/modules/event/event.controller.ts
var createEvent = catchAsync(async (req, res) => {
  const newEvent = await createEventService(req.body);
  res.status(201).json({
    success: true,
    message: "Campus event created successfully.",
    data: newEvent
  });
});
var getEvents = catchAsync(async (req, res) => {
  const events = await getAllEventsService();
  res.status(200).json({
    success: true,
    message: "Campus events retrieved successfully.",
    data: events
  });
});
var deleteEvent2 = catchAsync(async (req, res) => {
  const id = req.params.id;
  await deleteEventService2(id);
  res.status(200).json({
    success: true,
    message: "Campus event deleted successfully."
  });
});

// src/modules/event/event.routes.ts
var router6 = Router6();
router6.post(
  "/",
  requireAuth,
  requireAdmin,
  validateRequest(createEventSchema),
  createEvent
);
router6.get("/", requireAuth, getEvents);
router6.delete("/:id", requireAuth, requireAdmin, deleteEvent2);
var eventRoutes = router6;

// src/modules/user/user.routes.ts
import { Router as Router7 } from "express";

// src/modules/user/user.schema.ts
import { z as z8 } from "zod";
var updateRoleSchema = z8.object({
  body: z8.object({
    action: z8.enum(["MAKE_CR", "MAKE_TA", "REMOVE_ROLE"], {
      message: "Invalid action. Must be MAKE_CR, MAKE_TA, or REMOVE_ROLE"
    })
  })
});

// src/modules/user/user.repository.ts
var findUsersWithProfiles = async (where, skip, take) => {
  return await prisma.user.findMany({
    where,
    skip,
    take,
    include: {
      studentProfile: true,
      teacherProfile: true
    },
    orderBy: {
      createdAt: "desc"
    }
  });
};
var countUsers = async (where) => {
  return await prisma.user.count({ where });
};
var findUserById = async (id) => {
  return await prisma.user.findUnique({
    where: { id }
  });
};
var findUserWithStudentProfile = async (id) => {
  return await prisma.user.findUnique({
    where: { id },
    include: { studentProfile: true }
  });
};
var deleteUserById2 = async (id) => {
  return await prisma.user.delete({
    where: { id }
  });
};
var updateStudentProfileByUserId = async (userId, data) => {
  return await prisma.studentProfile.update({
    where: { userId },
    data
  });
};

// src/modules/user/user.service.ts
var getAllUsersService = async (query) => {
  const page = Math.max(1, Number(query?.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(query?.limit) || 25));
  const skip = (page - 1) * limit;
  const where = {};
  if (query?.role) {
    where.role = query.role;
  }
  if (query?.search) {
    where.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      { email: { contains: query.search, mode: "insensitive" } }
    ];
  }
  const [users, total] = await Promise.all([
    findUsersWithProfiles(where, skip, limit),
    countUsers(where)
  ]);
  return {
    data: users,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
};
var deleteUserService = async (id) => {
  const existingUser = await findUserById(id);
  if (!existingUser) {
    throw new AppError("User not found.", 404);
  }
  return await deleteUserById2(id);
};
var updateStudentRoleService = async (id, action) => {
  const user = await findUserWithStudentProfile(id);
  if (!user) {
    throw new AppError("User not found.", 404);
  }
  if (!user.studentProfile) {
    throw new AppError(
      "This action can only be performed on student accounts.",
      400
    );
  }
  let updateData = {};
  if (action === "MAKE_CR") {
    updateData = { isCR: true };
  } else if (action === "MAKE_TA") {
    updateData = { isTA: true };
  } else if (action === "REMOVE_ROLE") {
    updateData = { isCR: false, isTA: false };
  }
  return await updateStudentProfileByUserId(id, updateData);
};

// src/modules/user/user.controller.ts
var getAllUsers = catchAsync(async (req, res) => {
  const result = await getAllUsersService(req.query);
  res.status(200).json({
    success: true,
    message: "Users retrieved successfully.",
    data: result.data,
    meta: result.meta
  });
});
var deleteUser = catchAsync(async (req, res) => {
  const id = req.params.id;
  await deleteUserService(id);
  res.status(200).json({
    success: true,
    message: "User and associated profiles deleted successfully."
  });
});
var updateStudentRole = catchAsync(
  async (req, res) => {
    const id = req.params.id;
    const { action } = req.body;
    const updatedProfile = await updateStudentRoleService(
      id,
      action
    );
    res.status(200).json({
      success: true,
      message: `Student role updated successfully (${action}).`,
      data: updatedProfile
    });
  }
);

// src/modules/user/user.routes.ts
var router7 = Router7();
router7.get("/", requireAuth, requireAdmin, getAllUsers);
router7.delete("/:id", requireAuth, requireAdmin, deleteUser);
router7.patch(
  "/:id/role",
  requireAuth,
  requireAdmin,
  validateRequest(updateRoleSchema),
  updateStudentRole
);
var userRoutes = router7;

// src/modules/forum/forum.routes.ts
import { Router as Router8 } from "express";

// src/modules/forum/forum.schema.ts
import { z as z9 } from "zod";
var createPostSchema = z9.object({
  body: z9.object({
    title: z9.string().min(1, "Title is required"),
    description: z9.string().min(1, "Description is required")
  })
});
var createResponseSchema = z9.object({
  body: z9.object({
    content: z9.string().min(1, "Response content cannot be empty")
  })
});
var updatePostSchema = z9.object({
  body: z9.object({
    title: z9.string().min(1, "Title cannot be empty").optional(),
    description: z9.string().min(1, "Description cannot be empty").optional()
  })
});

// src/modules/forum/forum.repository.ts
var createHelpPost = async (authorId, data) => {
  return await prisma.helpPost.create({
    data: {
      title: data.title,
      description: data.description,
      authorId
    }
  });
};
var findHelpPosts = async (where, skip, take) => {
  return await prisma.helpPost.findMany({
    where,
    skip,
    take,
    orderBy: {
      createdAt: "desc"
    },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          image: true,
          role: true
        }
      },
      _count: {
        select: { responses: true }
      }
    }
  });
};
var countHelpPosts = async (where) => {
  return await prisma.helpPost.count({ where });
};
var findHelpPostById = async (id) => {
  return await prisma.helpPost.findUnique({
    where: { id }
  });
};
var findHelpPostWithDetails = async (id) => {
  return await prisma.helpPost.findUnique({
    where: { id },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          image: true,
          role: true,
          studentProfile: true,
          teacherProfile: true
        }
      },
      responses: {
        orderBy: { createdAt: "asc" },
        include: {
          responder: {
            select: {
              id: true,
              name: true,
              image: true,
              role: true,
              studentProfile: true,
              teacherProfile: true
            }
          }
        }
      }
    }
  });
};
var createHelpResponse = async (postId, responderId, data) => {
  return await prisma.helpResponse.create({
    data: {
      content: data.content,
      postId,
      responderId
    }
  });
};
var updateHelpPost = async (id, data) => {
  return await prisma.helpPost.update({
    where: { id },
    data
  });
};
var deleteHelpPostById = async (id) => {
  return await prisma.helpPost.delete({
    where: { id }
  });
};

// src/modules/forum/forum.service.ts
var createPostService = async (authorId, data) => {
  return await createHelpPost(authorId, data);
};
var getAllPostsService = async (query) => {
  const page = Math.max(1, Number(query?.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(query?.limit) || 25));
  const skip = (page - 1) * limit;
  const where = {};
  if (query?.filter === "UNRESOLVED") {
    where.isResolved = false;
  } else if (query?.filter === "RESOLVED") {
    where.isResolved = true;
  }
  if (query?.search) {
    where.OR = [
      { title: { contains: query.search, mode: "insensitive" } },
      { description: { contains: query.search, mode: "insensitive" } }
    ];
  }
  const [posts, total] = await Promise.all([
    findHelpPosts(where, skip, limit),
    countHelpPosts(where)
  ]);
  return {
    data: posts,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
};
var getSinglePostService = async (id) => {
  const post = await findHelpPostWithDetails(id);
  if (!post) {
    throw new AppError("Forum post not found.", 404);
  }
  return post;
};
var createResponseService = async (postId, responderId, data) => {
  const post = await findHelpPostById(postId);
  if (!post) {
    throw new AppError("Forum post not found.", 404);
  }
  return await createHelpResponse(postId, responderId, data);
};
var resolvePostService = async (postId, userId, role) => {
  const post = await findHelpPostById(postId);
  if (!post) {
    throw new AppError("Forum post not found.", 404);
  }
  if (post.authorId !== userId && role !== "ADMIN") {
    throw new AppError(
      "You do not have permission to perform this action.",
      403
    );
  }
  return await updateHelpPost(postId, { isResolved: true });
};
var updatePostService = async (postId, userId, data) => {
  const post = await findHelpPostById(postId);
  if (!post) {
    throw new AppError("Forum post not found.", 404);
  }
  if (post.authorId !== userId) {
    throw new AppError("You do not have permission to edit this post.", 403);
  }
  return await updateHelpPost(postId, data);
};
var deletePostService = async (postId, userId, role) => {
  const post = await findHelpPostById(postId);
  if (!post) {
    throw new AppError("Forum post not found.", 404);
  }
  if (post.authorId !== userId && role !== "ADMIN") {
    throw new AppError(
      "You do not have permission to perform this action.",
      403
    );
  }
  return await deleteHelpPostById(postId);
};

// src/modules/forum/forum.controller.ts
var createPost = catchAsync(async (req, res) => {
  const authorId = req.user.id;
  const newPost = await createPostService(authorId, req.body);
  res.status(201).json({
    success: true,
    message: "Forum post created successfully.",
    data: newPost
  });
});
var getFeed = catchAsync(async (req, res) => {
  const result = await getAllPostsService(req.query);
  res.status(200).json({
    success: true,
    message: "Forum feed retrieved successfully.",
    data: result.data,
    meta: result.meta
  });
});
var getThread = catchAsync(async (req, res) => {
  const id = req.params.id;
  const post = await getSinglePostService(id);
  res.status(200).json({
    success: true,
    message: "Forum thread retrieved successfully.",
    data: post
  });
});
var replyToPost = catchAsync(async (req, res) => {
  const postId = req.params.id;
  const responderId = req.user.id;
  const response = await createResponseService(
    postId,
    responderId,
    req.body
  );
  res.status(201).json({
    success: true,
    message: "Reply added successfully.",
    data: response
  });
});
var markResolved = catchAsync(async (req, res) => {
  const postId = req.params.id;
  const userId = req.user.id;
  const role = req.user.role;
  const resolvedPost = await resolvePostService(
    postId,
    userId,
    role
  );
  res.status(200).json({
    success: true,
    message: "Post marked as resolved successfully.",
    data: resolvedPost
  });
});
var updatePost = catchAsync(async (req, res) => {
  const postId = req.params.id;
  const userId = req.user.id;
  const updatedPost = await updatePostService(
    postId,
    userId,
    req.body
  );
  res.status(200).json({
    success: true,
    message: "Forum post updated successfully.",
    data: updatedPost
  });
});
var deletePost = catchAsync(async (req, res) => {
  const postId = req.params.id;
  const userId = req.user.id;
  const role = req.user.role;
  await deletePostService(postId, userId, role);
  res.status(200).json({
    success: true,
    message: "Forum post deleted successfully."
  });
});

// src/modules/forum/forum.routes.ts
var router8 = Router8();
router8.post("/", requireAuth, validateRequest(createPostSchema), createPost);
router8.get("/", requireAuth, getFeed);
router8.get("/:id", requireAuth, getThread);
router8.post(
  "/:id/respond",
  requireAuth,
  validateRequest(createResponseSchema),
  replyToPost
);
router8.patch("/:id/resolve", requireAuth, markResolved);
router8.patch(
  "/:id",
  requireAuth,
  validateRequest(updatePostSchema),
  updatePost
);
router8.delete("/:id", requireAuth, deletePost);
var forumRoutes = router8;

// src/modules/blood/blood.routes.ts
import { Router as Router9 } from "express";

// src/modules/blood/blood.schema.ts
import { z as z10 } from "zod";
var createBloodPostSchema = z10.object({
  body: z10.object({
    patientName: z10.string().min(1, "Patient name is required"),
    patientCondition: z10.string().min(1, "Patient condition is required"),
    bloodGroup: z10.enum(BLOOD_GROUP_VALUES, {
      message: "Valid blood group is required"
    }),
    location: z10.string().min(1, "Location is required"),
    urgency: z10.string().min(1, "Urgency is required"),
    contactPhone: z10.string().min(1, "Contact phone is required")
  })
});
var respondBloodPostSchema = z10.object({
  body: z10.object({
    message: z10.string().optional()
  })
});

// src/modules/blood/blood.repository.ts
var createBloodPost = async (authorId, data) => {
  return await prisma.bloodPost.create({
    data: {
      ...data,
      authorId
    }
  });
};
var findBloodFeed = async (take = 100) => {
  return await prisma.bloodPost.findMany({
    orderBy: {
      createdAt: "desc"
    },
    take,
    include: {
      author: {
        select: { id: true, name: true, image: true }
      },
      _count: {
        select: { responses: true }
      }
    }
  });
};
var findBloodPostById = async (id) => {
  return await prisma.bloodPost.findUnique({
    where: { id }
  });
};
var findBloodPostWithDetails = async (id) => {
  return await prisma.bloodPost.findUnique({
    where: { id },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          image: true,
          bloodGroup: true,
          phoneNumber: true,
          studentProfile: true,
          teacherProfile: true
        }
      },
      responses: {
        orderBy: { createdAt: "asc" },
        include: {
          responder: {
            select: {
              id: true,
              name: true,
              image: true,
              bloodGroup: true,
              phoneNumber: true,
              studentProfile: true,
              teacherProfile: true
            }
          }
        }
      }
    }
  });
};
var findBloodResponse = async (postId, responderId) => {
  return await prisma.bloodResponse.findFirst({
    where: { postId, responderId }
  });
};
var createBloodResponse = async (postId, responderId, message) => {
  return await prisma.bloodResponse.create({
    data: {
      postId,
      responderId,
      message
    }
  });
};
var updateBloodPostFulfilled = async (id, isFulfilled) => {
  return await prisma.bloodPost.update({
    where: { id },
    data: { isFulfilled }
  });
};
var deleteBloodPostById = async (id) => {
  return await prisma.bloodPost.delete({
    where: { id }
  });
};

// src/modules/blood/blood.service.ts
var createBloodPostService = async (authorId, data) => {
  return await createBloodPost(authorId, data);
};
var getBloodFeedService = async () => {
  return await findBloodFeed(100);
};
var getBloodPostByIdService = async (id) => {
  const post = await findBloodPostWithDetails(id);
  if (!post) {
    throw new AppError("Blood request not found.", 404);
  }
  return post;
};
var respondToBloodPostService = async (postId, responderId, data) => {
  const post = await findBloodPostById(postId);
  if (!post) {
    throw new AppError("Blood request not found.", 404);
  }
  if (post.authorId === responderId) {
    throw new AppError("You cannot volunteer for your own blood request.", 400);
  }
  const existingResponse = await findBloodResponse(
    postId,
    responderId
  );
  if (existingResponse) {
    throw new AppError("You have already responded to this request.", 409);
  }
  return await createBloodResponse(
    postId,
    responderId,
    data.message
  );
};
var resolveBloodPostService = async (postId, userId, role) => {
  const post = await findBloodPostById(postId);
  if (!post) {
    throw new AppError("Blood request not found.", 404);
  }
  if (post.authorId !== userId && role !== "ADMIN") {
    throw new AppError(
      "You do not have permission to mark this request as fulfilled.",
      403
    );
  }
  return await updateBloodPostFulfilled(postId, true);
};
var deleteBloodPostService = async (postId, userId, role) => {
  const post = await findBloodPostById(postId);
  if (!post) {
    throw new AppError("Blood request not found.", 404);
  }
  if (post.authorId !== userId && role !== "ADMIN") {
    throw new AppError(
      "You do not have permission to delete this request.",
      403
    );
  }
  return await deleteBloodPostById(postId);
};

// src/modules/blood/blood.controller.ts
var createBloodPost2 = catchAsync(
  async (req, res) => {
    const authorId = req.user.id;
    const newPost = await createBloodPostService(
      authorId,
      req.body
    );
    res.status(201).json({
      success: true,
      message: "Blood request created successfully.",
      data: newPost
    });
  }
);
var getBloodFeed = catchAsync(async (req, res) => {
  const posts = await getBloodFeedService();
  res.status(200).json({
    success: true,
    message: "Blood feed retrieved successfully.",
    data: posts
  });
});
var getBloodPostById = catchAsync(
  async (req, res) => {
    const id = req.params.id;
    const post = await getBloodPostByIdService(id);
    res.status(200).json({
      success: true,
      message: "Blood request retrieved successfully.",
      data: post
    });
  }
);
var respondToBloodPost = catchAsync(
  async (req, res) => {
    const postId = req.params.id;
    const responderId = req.user.id;
    const response = await respondToBloodPostService(
      postId,
      responderId,
      req.body
    );
    res.status(201).json({
      success: true,
      message: "Successfully volunteered for this request.",
      data: response
    });
  }
);
var markBloodPostResolved = catchAsync(
  async (req, res) => {
    const postId = req.params.id;
    const userId = req.user.id;
    const role = req.user.role;
    const resolvedPost = await resolveBloodPostService(
      postId,
      userId,
      role
    );
    res.status(200).json({
      success: true,
      message: "Request marked as fulfilled.",
      data: resolvedPost
    });
  }
);
var deleteBloodPost = catchAsync(
  async (req, res) => {
    const postId = req.params.id;
    const userId = req.user.id;
    const role = req.user.role;
    await deleteBloodPostService(postId, userId, role);
    res.status(200).json({
      success: true,
      message: "Blood request deleted successfully."
    });
  }
);

// src/modules/blood/blood.routes.ts
var router9 = Router9();
router9.post(
  "/",
  requireAuth,
  validateRequest(createBloodPostSchema),
  createBloodPost2
);
router9.get("/", requireAuth, getBloodFeed);
router9.get("/:id", requireAuth, getBloodPostById);
router9.post(
  "/:id/respond",
  requireAuth,
  validateRequest(respondBloodPostSchema),
  respondToBloodPost
);
router9.patch("/:id/resolve", requireAuth, markBloodPostResolved);
router9.delete("/:id", requireAuth, deleteBloodPost);
var bloodRoutes = router9;

// src/modules/directory/directory.routes.ts
import { Router as Router10 } from "express";

// src/modules/directory/directory.repository.ts
var findTeachersDirectory = async () => {
  return await prisma.user.findMany({
    where: {
      role: "TEACHER"
    },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      phoneNumber: true,
      teacherProfile: true
    },
    orderBy: {
      name: "asc"
    }
  });
};

// src/modules/directory/directory.service.ts
var getAllTeachersService = async () => {
  return await findTeachersDirectory();
};

// src/modules/directory/directory.controller.ts
var getAllTeachers = catchAsync(
  async (req, res) => {
    const teachers = await getAllTeachersService();
    res.status(200).json({
      success: true,
      message: "Teachers directory retrieved successfully.",
      data: teachers
    });
  }
);

// src/modules/directory/directory.routes.ts
var router10 = Router10();
router10.get("/teachers", requireAuth, getAllTeachers);
var directoryRoutes = router10;

// src/modules/complaint/complaint.routes.ts
import { Router as Router11 } from "express";

// src/modules/complaint/complaint.schema.ts
import { z as z11 } from "zod";
var createComplaintSchema = z11.object({
  body: z11.object({
    title: z11.string().min(1, "Title is required"),
    description: z11.string().min(1, "Description is required"),
    category: z11.string().min(1, "Category is required")
  })
});
var updateComplaintStatusSchema = z11.object({
  body: z11.object({
    status: z11.enum(COMPLAINT_STATUS_VALUES, {
      message: "Status must be PENDING, RESOLVED, or REJECTED"
    })
  })
});

// src/modules/complaint/complaint.repository.ts
var createComplaint = async (userId, data) => {
  return await prisma.complaint.create({
    data: { ...data, userId }
  });
};
var findComplaintsByUserId = async (userId, take = 100) => {
  return await prisma.complaint.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take
  });
};
var findAllComplaints = async (take = 100) => {
  return await prisma.complaint.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } }
    },
    take
  });
};
var findComplaintById = async (id) => {
  return await prisma.complaint.findUnique({
    where: { id }
  });
};
var updateComplaintStatus = async (id, status) => {
  return await prisma.complaint.update({
    where: { id },
    data: { status }
  });
};
var deleteComplaintById = async (id) => {
  return await prisma.complaint.delete({
    where: { id }
  });
};

// src/modules/complaint/complaint.service.ts
var createComplaintService = async (userId, data) => {
  return await createComplaint(userId, data);
};
var getMyComplaintsService = async (userId) => {
  return await findComplaintsByUserId(userId, 100);
};
var getAllComplaintsService = async () => {
  return await findAllComplaints(100);
};
var updateComplaintStatusService = async (id, status) => {
  const complaint = await findComplaintById(id);
  if (!complaint) throw new AppError("Complaint not found", 404);
  return await updateComplaintStatus(id, status);
};
var deleteComplaintService = async (id) => {
  const complaint = await findComplaintById(id);
  if (!complaint) throw new AppError("Complaint not found", 404);
  return await deleteComplaintById(id);
};

// src/modules/complaint/complaint.controller.ts
var createComplaint2 = catchAsync(
  async (req, res) => {
    const newComplaint = await createComplaintService(
      req.user.id,
      req.body
    );
    res.status(201).json({
      success: true,
      message: "Complaint created successfully.",
      data: newComplaint
    });
  }
);
var getMyComplaints = catchAsync(
  async (req, res) => {
    const complaints = await getMyComplaintsService(
      req.user.id
    );
    res.status(200).json({
      success: true,
      message: "My complaints retrieved.",
      data: complaints
    });
  }
);
var getAllComplaints = catchAsync(
  async (req, res) => {
    const complaints = await getAllComplaintsService();
    res.status(200).json({
      success: true,
      message: "All complaints retrieved.",
      data: complaints
    });
  }
);
var updateComplaintStatus2 = catchAsync(
  async (req, res) => {
    const updatedComplaint = await updateComplaintStatusService(
      req.params.id,
      req.body.status
    );
    res.status(200).json({
      success: true,
      message: "Status updated.",
      data: updatedComplaint
    });
  }
);
var deleteComplaint = catchAsync(
  async (req, res) => {
    await deleteComplaintService(req.params.id);
    res.status(200).json({ success: true, message: "Complaint deleted." });
  }
);

// src/modules/complaint/complaint.routes.ts
var router11 = Router11();
router11.post(
  "/",
  requireAuth,
  validateRequest(createComplaintSchema),
  createComplaint2
);
router11.get("/my", requireAuth, getMyComplaints);
router11.get("/", requireAuth, requireAdmin, getAllComplaints);
router11.patch(
  "/:id/status",
  requireAuth,
  requireAdmin,
  validateRequest(updateComplaintStatusSchema),
  updateComplaintStatus2
);
router11.delete("/:id", requireAuth, requireAdmin, deleteComplaint);
var complaintRoutes = router11;

// src/modules/alumni/alumni.routes.ts
import { Router as Router12 } from "express";

// src/modules/alumni/alumni.schema.ts
import { z as z12 } from "zod";
var alumniCoreSchema = z12.object({
  name: z12.string().min(1, "Name is required"),
  email: z12.string().email("Invalid email").optional().nullable(),
  batch: z12.string().min(1, "Batch is required"),
  graduationYear: z12.number().int().positive(),
  department: z12.string().min(1, "Department is required"),
  degree: z12.string().optional().nullable(),
  currentCompany: z12.string().optional().nullable(),
  currentPosition: z12.string().optional().nullable(),
  skills: z12.array(z12.string()).default([]),
  linkedInUrl: z12.string().url({ message: "Invalid URL" }).or(z12.literal("")).optional().nullable(),
  personalWebsiteUrl: z12.string().url({ message: "Invalid URL" }).or(z12.literal("")).optional().nullable(),
  image: z12.string().optional().nullable()
});
var createAlumniSchema = z12.object({ body: alumniCoreSchema });
var bulkCreateAlumniSchema = z12.object({
  body: z12.array(alumniCoreSchema).min(1)
});
var updateAlumniSchema = z12.object({
  body: alumniCoreSchema.partial()
});

// src/modules/alumni/alumni.repository.ts
var findAllAlumni = async (take = 100) => {
  return await prisma.alumni.findMany({
    orderBy: { graduationYear: "desc" },
    take
  });
};
var createAlumni = async (data) => {
  return await prisma.alumni.create({ data });
};
var bulkCreateAlumni = async (dataArray) => {
  return await prisma.alumni.createMany({
    data: dataArray,
    skipDuplicates: true
  });
};
var findAlumniById = async (id) => {
  return await prisma.alumni.findUnique({
    where: { id }
  });
};
var updateAlumni = async (id, data) => {
  return await prisma.alumni.update({
    where: { id },
    data
  });
};
var deleteAlumniById = async (id) => {
  return await prisma.alumni.delete({
    where: { id }
  });
};

// src/modules/alumni/alumni.service.ts
var getAllAlumniService = async () => {
  return await findAllAlumni(100);
};
var createAlumniService = async (data) => {
  return await createAlumni(data);
};
var bulkCreateAlumniService = async (dataArray) => {
  return await bulkCreateAlumni(dataArray);
};
var updateAlumniService = async (id, data) => {
  const alumni = await findAlumniById(id);
  if (!alumni) throw new AppError("Alumni not found", 404);
  return await updateAlumni(id, data);
};
var deleteAlumniService = async (id) => {
  const alumni = await findAlumniById(id);
  if (!alumni) throw new AppError("Alumni not found", 404);
  return await deleteAlumniById(id);
};

// src/modules/alumni/alumni.controller.ts
var getAllAlumni = catchAsync(async (req, res) => {
  const alumni = await getAllAlumniService();
  res.status(200).json({ success: true, data: alumni });
});
var createAlumni2 = catchAsync(async (req, res) => {
  const alumni = await createAlumniService(req.body);
  res.status(201).json({ success: true, message: "Alumni created", data: alumni });
});
var bulkCreateAlumni2 = catchAsync(
  async (req, res) => {
    const result = await bulkCreateAlumniService(req.body);
    res.status(201).json({ success: true, message: "Bulk insert complete", data: result });
  }
);
var updateAlumni2 = catchAsync(async (req, res) => {
  const alumni = await updateAlumniService(
    req.params.id,
    req.body
  );
  res.status(200).json({ success: true, message: "Alumni updated", data: alumni });
});
var deleteAlumni = catchAsync(async (req, res) => {
  await deleteAlumniService(req.params.id);
  res.status(200).json({ success: true, message: "Alumni deleted" });
});

// src/modules/alumni/alumni.routes.ts
var router12 = Router12();
router12.get("/", requireAuth, getAllAlumni);
router12.post(
  "/",
  requireAuth,
  requireAdmin,
  validateRequest(createAlumniSchema),
  createAlumni2
);
router12.post(
  "/bulk",
  requireAuth,
  requireAdmin,
  validateRequest(bulkCreateAlumniSchema),
  bulkCreateAlumni2
);
router12.patch(
  "/:id",
  requireAuth,
  requireAdmin,
  validateRequest(updateAlumniSchema),
  updateAlumni2
);
router12.delete("/:id", requireAuth, requireAdmin, deleteAlumni);
var alumniRoutes = router12;

// src/modules/field/field.routes.ts
import { Router as Router13 } from "express";

// src/modules/field/field.schema.ts
import { z as z13 } from "zod";
var datePreprocess = z13.preprocess(
  (val) => {
    if (!val) return void 0;
    if (val instanceof Date) return val;
    return new Date(val);
  },
  z13.date({ message: "Invalid date format" })
);
var updateFieldSettingsSchema = z13.object({
  body: z13.object({
    isBookingOpen: z13.boolean(),
    closedNotice: z13.string().optional().nullable()
  })
});
var bookFieldSchema = z13.object({
  body: z13.object({
    purpose: z13.string().min(1, "Purpose is required"),
    bookingDate: datePreprocess,
    startTime: datePreprocess,
    endTime: datePreprocess
  })
});
var updateBookingStatusSchema = z13.object({
  body: z13.object({
    status: z13.enum(["APPROVED", "REJECTED"], {
      message: "Status must be APPROVED or REJECTED"
    })
  })
});

// src/modules/field/field.repository.ts
var findFieldSettings = async () => {
  return await prisma.fieldSetting.findFirst();
};
var createDefaultFieldSettings = async () => {
  return await prisma.fieldSetting.create({
    data: { isBookingOpen: true }
  });
};
var updateFieldSettings = async (id, data) => {
  return await prisma.fieldSetting.update({
    where: { id },
    data
  });
};
var findConflictingApprovedBooking = async (bookingDate, startTime, endTime) => {
  return await prisma.fieldBooking.findFirst({
    where: {
      status: "APPROVED",
      bookingDate,
      startTime: { lt: endTime },
      endTime: { gt: startTime }
    }
  });
};
var createFieldBooking = async (userId, data) => {
  return await prisma.fieldBooking.create({
    data: { ...data, userId }
  });
};
var findBookingsByUserId = async (userId, take = 100) => {
  return await prisma.fieldBooking.findMany({
    where: { userId },
    orderBy: { bookingDate: "desc" },
    take
  });
};
var findAllBookings = async (take = 100) => {
  return await prisma.fieldBooking.findMany({
    orderBy: { bookingDate: "desc" },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } }
    },
    take
  });
};
var findApprovedFutureSchedule = async (today, take = 100) => {
  return await prisma.fieldBooking.findMany({
    where: {
      status: "APPROVED",
      bookingDate: {
        gte: today
      }
    },
    include: {
      user: { select: { name: true } }
    },
    orderBy: [{ bookingDate: "asc" }, { startTime: "asc" }],
    take
  });
};
var findBookingById = async (id) => {
  return await prisma.fieldBooking.findUnique({
    where: { id }
  });
};
var updateBookingStatus = async (id, status) => {
  return await prisma.fieldBooking.update({
    where: { id },
    data: { status }
  });
};

// src/modules/field/field.service.ts
var getFieldSettingsService = async () => {
  let settings = await findFieldSettings();
  if (!settings) {
    settings = await createDefaultFieldSettings();
  }
  return settings;
};
var updateFieldSettingsService = async (data) => {
  const settings = await getFieldSettingsService();
  return await updateFieldSettings(settings.id, data);
};
var bookFieldService = async (userId, data) => {
  const settings = await getFieldSettingsService();
  if (!settings.isBookingOpen) {
    throw new AppError(
      settings.closedNotice || "Field bookings are currently closed.",
      403
    );
  }
  const conflictingBooking = await findConflictingApprovedBooking(
    data.bookingDate,
    data.startTime,
    data.endTime
  );
  if (conflictingBooking) {
    throw new AppError(
      "Cannot request booking. This time slot is already reserved by another event.",
      400
    );
  }
  return await createFieldBooking(userId, data);
};
var getMyBookingsService = async (userId) => {
  return await findBookingsByUserId(userId, 100);
};
var getAllBookingsService = async () => {
  return await findAllBookings(100);
};
var getApprovedScheduleService = async () => {
  const today = /* @__PURE__ */ new Date();
  today.setHours(0, 0, 0, 0);
  return await findApprovedFutureSchedule(today, 100);
};
var updateBookingStatusService = async (id, status) => {
  const booking = await findBookingById(id);
  if (!booking) throw new AppError("Booking not found", 404);
  if (status === "APPROVED") {
    const conflictingBooking = await findConflictingApprovedBooking(
      booking.bookingDate,
      booking.startTime,
      booking.endTime
    );
    if (conflictingBooking) {
      throw new AppError(
        "Cannot approve. This time slot overlaps with an already approved booking.",
        400
      );
    }
  }
  return await updateBookingStatus(id, status);
};

// src/modules/field/field.controller.ts
var getFieldSettings = catchAsync(
  async (req, res) => {
    const settings = await getFieldSettingsService();
    res.status(200).json({ success: true, data: settings });
  }
);
var updateFieldSettings2 = catchAsync(
  async (req, res) => {
    const settings = await updateFieldSettingsService(req.body);
    res.status(200).json({ success: true, message: "Settings updated", data: settings });
  }
);
var bookField = catchAsync(async (req, res) => {
  const booking = await bookFieldService(req.user.id, req.body);
  res.status(201).json({ success: true, message: "Booking requested", data: booking });
});
var getMyBookings = catchAsync(async (req, res) => {
  const bookings = await getMyBookingsService(req.user.id);
  res.status(200).json({ success: true, data: bookings });
});
var getAllBookings = catchAsync(
  async (req, res) => {
    const bookings = await getAllBookingsService();
    res.status(200).json({ success: true, data: bookings });
  }
);
var getApprovedSchedule = catchAsync(
  async (req, res) => {
    const schedule = await getApprovedScheduleService();
    res.status(200).json({ success: true, data: schedule });
  }
);
var updateBookingStatus2 = catchAsync(
  async (req, res) => {
    const id = req.params.id;
    const booking = await updateBookingStatusService(
      id,
      req.body.status
    );
    res.status(200).json({
      success: true,
      message: "Booking status updated",
      data: booking
    });
  }
);

// src/modules/field/field.routes.ts
var router13 = Router13();
router13.get("/settings", requireAuth, getFieldSettings);
router13.patch(
  "/settings",
  requireAuth,
  requireAdmin,
  validateRequest(updateFieldSettingsSchema),
  updateFieldSettings2
);
router13.get("/schedule", requireAuth, getApprovedSchedule);
router13.post("/book", requireAuth, validateRequest(bookFieldSchema), bookField);
router13.get("/my-bookings", requireAuth, getMyBookings);
router13.get("/bookings", requireAuth, requireAdmin, getAllBookings);
router13.patch(
  "/bookings/:id/status",
  requireAuth,
  requireAdmin,
  validateRequest(updateBookingStatusSchema),
  updateBookingStatus2
);
var fieldRoutes = router13;

// src/modules/hub/hub.routes.ts
import { Router as Router18 } from "express";

// src/modules/hub/hub.schema.ts
import { z as z14 } from "zod";
var createHubSchema = z14.object({
  body: z14.object({
    courseCode: z14.string().min(1, "Course code is required"),
    courseName: z14.string().min(1, "Course name is required"),
    credit: z14.number().positive(),
    termOffer: z14.string().min(1, "Term offer is required"),
    weeklyClassSchedule: z14.array(
      z14.object({
        day: z14.string(),
        startTime: z14.string(),
        endTime: z14.string(),
        room: z14.string().optional()
      })
    ).min(1, "At least one class schedule is required"),
    department: z14.string().min(1, "Department is required"),
    batch: z14.string().min(1, "Batch is required"),
    semesterNumber: z14.number().positive(),
    teacherId: z14.string().optional()
  })
});
var joinHubSchema = z14.object({
  body: z14.object({
    joinCode: z14.string().length(6, { message: "Join code must be exactly 6 characters" })
  })
});
var updateMemberRoleSchema = z14.object({
  body: z14.object({
    role: z14.enum(HUB_ROLE_VALUES)
  })
});
var updateHubSchema = z14.object({
  body: z14.object({
    courseName: z14.string().optional(),
    department: z14.string().optional(),
    batch: z14.string().optional(),
    termOffer: z14.string().optional(),
    weeklyClassSchedule: z14.any().optional(),
    isReviewOpen: z14.boolean().optional(),
    termExams: z14.array(
      z14.object({
        type: z14.string().min(1, "Exam type is required (e.g., Midterm, Final)"),
        date: z14.string().optional(),
        time: z14.string().optional(),
        room: z14.string().optional()
      })
    ).optional()
  })
});
var archiveHubSchema = z14.object({
  body: z14.object({
    isArchived: z14.boolean()
  })
});

// src/modules/hub/hub.repository.ts
var findHubMember = async (userId, hubId) => {
  return await prisma.hubMember.findUnique({
    where: { userId_hubId: { userId, hubId } }
  });
};
var findAvailableTeachers = async () => {
  return await prisma.user.findMany({
    where: { role: "TEACHER" },
    select: {
      id: true,
      name: true,
      email: true,
      teacherProfile: { select: { department: true, designation: true } }
    },
    orderBy: { name: "asc" }
  });
};
var findUserWithStudentProfile2 = async (userId) => {
  return await prisma.user.findUnique({
    where: { id: userId },
    include: { studentProfile: true }
  });
};
var createHubWithMembers = async (userId, data, isTeacher, isCR, joinCode) => {
  return await prisma.$transaction(async (tx) => {
    const hub = await tx.courseHub.create({
      data: {
        courseCode: data.courseCode,
        courseName: data.courseName,
        credit: data.credit,
        termOffer: data.termOffer,
        weeklyClassSchedule: data.weeklyClassSchedule,
        department: data.department,
        batch: data.batch,
        semesterNumber: data.semesterNumber,
        joinCode
      }
    });
    await tx.hubMember.create({
      data: { userId, hubId: hub.id, role: isTeacher ? "TEACHER" : "CR" }
    });
    if (isCR && data.teacherId) {
      await tx.hubMember.create({
        data: { userId: data.teacherId, hubId: hub.id, role: "TEACHER" }
      });
    }
    return hub;
  });
};
var findHubByJoinCode = async (joinCode) => {
  return await prisma.courseHub.findUnique({ where: { joinCode } });
};
var createHubMember = async (userId, hubId, role = "STUDENT") => {
  return await prisma.hubMember.create({
    data: { userId, hubId, role },
    include: { hub: true }
  });
};
var findMyHubMemberships = async (userId) => {
  return await prisma.hubMember.findMany({
    where: { userId },
    include: {
      hub: {
        include: {
          _count: { select: { members: true } },
          members: {
            where: { role: "TEACHER" },
            select: { user: { select: { name: true } } },
            take: 1
          },
          assessments: {
            where: { deadline: { gt: /* @__PURE__ */ new Date() } },
            orderBy: { deadline: "asc" },
            take: 1,
            select: { id: true, title: true, type: true, deadline: true }
          }
        }
      }
    }
  });
};
var findHubWithMembersAndDetails = async (hubId) => {
  return await prisma.courseHub.findUnique({
    where: { id: hubId },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              image: true,
              role: true,
              email: true,
              studentProfile: { select: { studentId: true } },
              teacherProfile: { select: { teacherId: true } }
            }
          }
        }
      }
    }
  });
};
var findHubMemberById = async (memberId) => {
  return await prisma.hubMember.findUnique({
    where: { id: memberId }
  });
};
var updateHubMemberRole = async (memberId, role) => {
  return await prisma.hubMember.update({
    where: { id: memberId },
    data: { role }
  });
};
var deleteHubMemberById = async (memberId) => {
  return await prisma.hubMember.delete({
    where: { id: memberId }
  });
};
var updateHub = async (hubId, data) => {
  return await prisma.courseHub.update({
    where: { id: hubId },
    data
  });
};
var updateHubArchiveStatus = async (hubId, isArchived) => {
  return await prisma.courseHub.update({
    where: { id: hubId },
    data: { isArchived }
  });
};
var deleteHubById = async (hubId) => {
  return await prisma.courseHub.delete({
    where: { id: hubId }
  });
};

// src/modules/hub/hub.service.ts
var verifyHubRole = async (userId, hubId, allowedRoles) => {
  const member = await findHubMember(userId, hubId);
  if (!member || !allowedRoles.includes(member.role)) {
    throw new AppError(
      "You do not have permission to perform this action in this hub.",
      403
    );
  }
  return member;
};
var getAvailableTeachersService = async () => {
  return await findAvailableTeachers();
};
var generateJoinCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();
var createHubService = async (userId, data) => {
  const user = await findUserWithStudentProfile2(userId);
  if (!user) throw new AppError("User not found", 404);
  const isCR = user.studentProfile?.isCR === true;
  const isTeacher = user.role === "TEACHER";
  if (!isCR && !isTeacher) {
    throw new AppError(
      "Only Teachers and Class Representatives can create a Hub.",
      403
    );
  }
  if (isCR && !data.teacherId) {
    throw new AppError(
      "CR must assign a teacher (teacherId) when creating a hub.",
      400
    );
  }
  const joinCode = generateJoinCode();
  return await createHubWithMembers(
    userId,
    data,
    isTeacher,
    isCR,
    joinCode
  );
};
var joinHubService = async (userId, joinCode) => {
  const hub = await findHubByJoinCode(joinCode);
  if (!hub) throw new AppError("Invalid join code.", 404);
  return await createHubMember(userId, hub.id, "STUDENT");
};
var getMyHubsService = async (userId) => {
  return await findMyHubMemberships(userId);
};
var getHubDetailsService = async (hubId) => {
  const hub = await findHubWithMembersAndDetails(hubId);
  if (!hub) throw new AppError("Hub not found", 404);
  return hub;
};
var updateMemberRoleService = async (userId, hubId, memberId, newRole) => {
  const requesterMember = await verifyHubRole(userId, hubId, [
    "TEACHER",
    "CR",
    "TA"
  ]);
  const targetMember = await findHubMemberById(memberId);
  if (!targetMember) throw new AppError("Member not found.", 404);
  if ((requesterMember.role === "CR" || requesterMember.role === "TA") && targetMember.role === "TEACHER") {
    throw new AppError(
      "Class Representatives and TAs cannot modify Teacher roles.",
      403
    );
  }
  if ((requesterMember.role === "CR" || requesterMember.role === "TA") && newRole === "TEACHER") {
    throw new AppError(
      "Class Representatives and TAs cannot assign Teacher roles.",
      403
    );
  }
  return await updateHubMemberRole(memberId, newRole);
};
var removeMemberService = async (userId, hubId, memberId) => {
  const targetMember = await findHubMemberById(memberId);
  if (!targetMember) throw new AppError("Member not found.", 404);
  if (targetMember.userId === userId) {
    return await deleteHubMemberById(memberId);
  }
  const requesterMember = await verifyHubRole(userId, hubId, [
    "TEACHER",
    "CR",
    "TA"
  ]);
  if ((requesterMember.role === "CR" || requesterMember.role === "TA") && targetMember.role === "TEACHER") {
    throw new AppError(
      "Class Representatives and TAs cannot remove Teachers from the hub.",
      403
    );
  }
  return await deleteHubMemberById(memberId);
};
var updateHubService = async (userId, hubId, data) => {
  await verifyHubRole(userId, hubId, ["TEACHER", "CR"]);
  return await updateHub(hubId, data);
};
var archiveHubService = async (userId, hubId, isArchived) => {
  await verifyHubRole(userId, hubId, ["TEACHER", "CR", "TA"]);
  return await updateHubArchiveStatus(hubId, isArchived);
};
var deleteHubService = async (userId, hubId) => {
  await verifyHubRole(userId, hubId, ["TEACHER", "CR"]);
  return await deleteHubById(hubId);
};

// src/modules/hub/hub.controller.ts
var createHub = catchAsync(async (req, res) => {
  const hub = await createHubService(req.user.id, req.body);
  res.status(201).json({ success: true, message: "Hub created successfully", data: hub });
});
var getAvailableTeachers = catchAsync(
  async (req, res) => {
    const teachers = await getAvailableTeachersService();
    res.status(200).json({ success: true, data: teachers });
  }
);
var joinHub = catchAsync(async (req, res) => {
  const member = await joinHubService(
    req.user.id,
    req.body.joinCode
  );
  res.status(200).json({ success: true, message: "Joined hub successfully", data: member });
});
var getMyHubs = catchAsync(async (req, res) => {
  const hubs = await getMyHubsService(req.user.id);
  res.status(200).json({ success: true, data: hubs });
});
var getHubDetails = catchAsync(async (req, res) => {
  await verifyHubRole(req.user.id, req.params.id, [
    "TEACHER",
    "CR",
    "TA",
    "STUDENT"
  ]);
  const hub = await getHubDetailsService(req.params.id);
  res.status(200).json({ success: true, data: hub });
});
var updateMemberRole = catchAsync(
  async (req, res) => {
    const member = await updateMemberRoleService(
      req.user.id,
      req.params.id,
      req.params.memberId,
      req.body.role
    );
    res.status(200).json({ success: true, message: "Member role updated", data: member });
  }
);
var removeMember = catchAsync(async (req, res) => {
  await removeMemberService(
    req.user.id,
    req.params.id,
    req.params.memberId
  );
  res.status(200).json({
    success: true,
    message: "Member removed from the hub successfully."
  });
});
var updateHub2 = catchAsync(async (req, res) => {
  const hubId = req.params.id;
  const userId = req.user.id;
  const updatedHub = await updateHubService(userId, hubId, req.body);
  res.status(200).json({
    success: true,
    message: "Hub updated successfully",
    data: updatedHub
  });
});
var archiveHub = catchAsync(async (req, res) => {
  const hub = await archiveHubService(
    req.user.id,
    req.params.id,
    req.body.isArchived
  );
  res.status(200).json({ success: true, message: "Hub archive status updated", data: hub });
});
var deleteHub = catchAsync(async (req, res) => {
  await deleteHubService(req.user.id, req.params.id);
  res.status(200).json({
    success: true,
    message: "Course Hub and all associated data deleted successfully."
  });
});

// src/modules/hub/resources/resources.routes.ts
import { Router as Router14 } from "express";

// src/modules/hub/resources/resources.schema.ts
import { z as z15 } from "zod";
var createResourceSchema = z15.object({
  body: z15.object({
    title: z15.string().min(1, "Title is required"),
    driveUrl: z15.string().url("Must be a valid URL"),
    isStudentNote: z15.boolean().default(false)
  })
});

// src/modules/hub/resources/resources.repository.ts
var createResource = async (userId, hubId, data) => {
  return await prisma.resource.create({
    data: {
      ...data,
      hubId,
      uploaderId: userId
    }
  });
};
var findResourcesByHubId = async (hubId) => {
  return await prisma.resource.findMany({
    where: { hubId },
    include: {
      uploader: { select: { id: true, name: true, image: true, role: true } }
    },
    orderBy: { createdAt: "desc" }
  });
};

// src/modules/hub/resources/resources.service.ts
var createResourceService = async (userId, hubId, data) => {
  await verifyHubRole(userId, hubId, ["TEACHER", "CR", "TA", "STUDENT"]);
  return await createResource(userId, hubId, data);
};
var getResourcesService = async (hubId) => {
  return await findResourcesByHubId(hubId);
};

// src/modules/hub/resources/resources.controller.ts
var createResource2 = catchAsync(
  async (req, res) => {
    const data = await createResourceService(
      req.user.id,
      req.params.id,
      req.body
    );
    res.status(201).json({ success: true, message: "Resource uploaded", data });
  }
);
var getResources = catchAsync(async (req, res) => {
  const data = await getResourcesService(
    req.params.id
  );
  res.status(200).json({ success: true, data });
});

// src/modules/hub/resources/resources.routes.ts
var router14 = Router14({ mergeParams: true });
router14.post(
  "/:id/resources",
  requireAuth,
  validateRequest(createResourceSchema),
  createResource2
);
router14.get("/:id/resources", requireAuth, getResources);
var resourceRoutes = router14;

// src/modules/hub/content/content.routes.ts
import { Router as Router15 } from "express";

// src/modules/hub/content/content.schema.ts
import { z as z16 } from "zod";
var createAnnouncementSchema = z16.object({
  body: z16.object({
    content: z16.string().min(1, "Announcement content cannot be empty"),
    attachedLinkUrl: z16.string().url("Must be a valid URL").optional(),
    attachedLinkTitle: z16.string().optional()
  })
});
var createAnnouncementCommentSchema = z16.object({
  body: z16.object({
    content: z16.string().min(1, "Comment cannot be empty")
  })
});
var createDiscussionSchema = z16.object({
  body: z16.object({
    title: z16.string().min(1, "Title is required"),
    content: z16.string().min(1, "Discussion content cannot be empty")
  })
});
var replyDiscussionSchema = z16.object({
  body: z16.object({
    content: z16.string().min(1, "Reply content cannot be empty")
  })
});
var commentAnnouncementSchema = z16.object({
  body: z16.object({
    content: z16.string().min(1, "Comment content cannot be empty")
  })
});

// src/modules/hub/content/content.repository.ts
var createHubAnnouncement = async (userId, hubId, data) => {
  return await prisma.hubAnnouncement.create({
    data: {
      hubId,
      creatorId: userId,
      content: data.content,
      attachedLinkUrl: data.attachedLinkUrl,
      attachedLinkTitle: data.attachedLinkTitle
    }
  });
};
var findAnnouncementsByHubId = async (hubId) => {
  return await prisma.hubAnnouncement.findMany({
    where: { hubId },
    include: {
      creator: { select: { id: true, name: true, image: true } },
      comments: {
        include: { author: { select: { id: true, name: true, image: true } } },
        orderBy: { createdAt: "asc" }
      }
    },
    orderBy: { createdAt: "desc" }
  });
};
var createAnnouncementComment = async (userId, announcementId, content) => {
  return await prisma.announcementComment.create({
    data: { announcementId, authorId: userId, content }
  });
};
var createHubDiscussion = async (userId, hubId, data) => {
  return await prisma.hubDiscussion.create({
    data: {
      hubId,
      authorId: userId,
      title: data.title,
      content: data.content
    }
  });
};
var createDiscussionReply = async (userId, discussionId, content) => {
  return await prisma.hubDiscussionReply.create({
    data: { discussionId, authorId: userId, content }
  });
};
var findDiscussionsByHubId = async (hubId) => {
  return await prisma.hubDiscussion.findMany({
    where: { hubId },
    include: {
      replies: {
        include: { author: { select: { id: true, name: true, image: true } } },
        orderBy: { createdAt: "asc" }
      },
      author: { select: { id: true, name: true, image: true } }
    },
    orderBy: { createdAt: "desc" }
  });
};

// src/modules/hub/content/content.service.ts
var createAnnouncement = async (userId, hubId, data) => {
  await verifyHubRole(userId, hubId, ["TEACHER", "CR", "TA"]);
  return await createHubAnnouncement(userId, hubId, data);
};
var getAnnouncements = async (hubId) => {
  return await findAnnouncementsByHubId(hubId);
};
var createAnnouncementComment2 = async (userId, hubId, announcementId, content) => {
  await verifyHubRole(userId, hubId, ["TEACHER", "CR", "TA", "STUDENT"]);
  return await createAnnouncementComment(
    userId,
    announcementId,
    content
  );
};
var createDiscussion = async (userId, hubId, data) => {
  await verifyHubRole(userId, hubId, ["TEACHER", "CR", "TA", "STUDENT"]);
  return await createHubDiscussion(userId, hubId, data);
};
var replyToDiscussion = async (userId, hubId, discussionId, content) => {
  await verifyHubRole(userId, hubId, ["TEACHER", "CR", "TA", "STUDENT"]);
  return await createDiscussionReply(
    userId,
    discussionId,
    content
  );
};
var getDiscussions = async (hubId) => {
  return await findDiscussionsByHubId(hubId);
};
var commentOnAnnouncement = async (userId, hubId, announcementId, content) => {
  await verifyHubRole(userId, hubId, ["TEACHER", "CR", "TA", "STUDENT"]);
  return await createAnnouncementComment(
    userId,
    announcementId,
    content
  );
};

// src/modules/hub/content/content.controller.ts
var createAnnouncementComment3 = catchAsync(
  async (req, res) => {
    const data = await createAnnouncementComment2(
      req.user.id,
      req.params.id,
      req.params.announcementId,
      req.body.content
    );
    res.status(201).json({ success: true, message: "Comment posted", data });
  }
);
var createAnnouncement2 = catchAsync(
  async (req, res) => {
    const data = await createAnnouncement(
      req.user.id,
      req.params.id,
      req.body
    );
    res.status(201).json({ success: true, message: "Announcement posted", data });
  }
);
var getAnnouncements2 = catchAsync(
  async (req, res) => {
    const data = await getAnnouncements(req.params.id);
    res.status(200).json({ success: true, data });
  }
);
var createDiscussion2 = catchAsync(
  async (req, res) => {
    const data = await createDiscussion(
      req.user.id,
      req.params.id,
      req.body
    );
    res.status(201).json({ success: true, message: "Discussion posted", data });
  }
);
var replyDiscussion = catchAsync(
  async (req, res) => {
    const data = await replyToDiscussion(
      req.user.id,
      req.params.id,
      req.params.discussionId,
      req.body.content
    );
    res.status(201).json({ success: true, message: "Reply posted", data });
  }
);
var getDiscussions2 = catchAsync(
  async (req, res) => {
    const data = await getDiscussions(req.params.id);
    res.status(200).json({ success: true, data });
  }
);
var commentAnnouncement = catchAsync(
  async (req, res) => {
    const data = await commentOnAnnouncement(
      req.user.id,
      req.params.id,
      req.params.announcementId,
      req.body.content
    );
    res.status(201).json({ success: true, message: "Comment posted", data });
  }
);

// src/modules/hub/content/content.routes.ts
var router15 = Router15({ mergeParams: true });
router15.post(
  "/:id/announcements",
  requireAuth,
  validateRequest(createAnnouncementSchema),
  createAnnouncement2
);
router15.get("/:id/announcements", requireAuth, getAnnouncements2);
router15.post(
  "/:id/discussions",
  requireAuth,
  validateRequest(createDiscussionSchema),
  createDiscussion2
);
router15.get("/:id/discussions", requireAuth, getDiscussions2);
router15.post(
  "/:id/discussions/:discussionId/reply",
  requireAuth,
  validateRequest(replyDiscussionSchema),
  replyDiscussion
);
router15.post(
  "/:id/announcements/:announcementId/comments",
  requireAuth,
  validateRequest(commentAnnouncementSchema),
  commentAnnouncement
);
var contentRoutes = router15;

// src/modules/hub/assessments/assessments.routes.ts
import { Router as Router16 } from "express";

// src/modules/hub/assessments/assessments.schema.ts
import { z as z17 } from "zod";
var datePreprocess2 = z17.preprocess(
  (val) => {
    if (!val) return void 0;
    if (val instanceof Date) return val;
    return new Date(val);
  },
  z17.date({ message: "Invalid date format" })
);
var createAssessmentSchema = z17.object({
  body: z17.object({
    title: z17.string().min(1, "Title is required"),
    description: z17.string().optional(),
    type: z17.enum(ASSESSMENT_TYPE_VALUES),
    deadline: datePreprocess2,
    totalMarks: z17.number().positive()
  })
});
var submitAssessmentSchema = z17.object({
  body: z17.object({ submittedUrl: z17.string().url("Must provide a valid URL") })
});
var gradeSubmissionSchema = z17.object({
  body: z17.object({ marks: z17.number().min(0) })
});
var bulkGradeSchema = z17.object({
  body: z17.array(
    z17.object({
      studentId: z17.string(),
      marks: z17.number().min(0)
    })
  ).min(1, "Must provide at least one grade")
});

// src/modules/hub/assessments/assessments.repository.ts
var createAssessment = async (userId, hubId, data) => {
  return await prisma.assessment.create({
    data: {
      hubId,
      creatorId: userId,
      title: data.title,
      description: data.description,
      type: data.type,
      deadline: data.deadline,
      totalMarks: data.totalMarks
    }
  });
};
var findAssessmentsByHubId = async (hubId) => {
  return await prisma.assessment.findMany({
    where: { hubId },
    orderBy: { deadline: "asc" },
    include: {
      _count: {
        select: { submissions: true }
      }
    }
  });
};
var findAssessmentById = async (assessmentId) => {
  return await prisma.assessment.findUnique({
    where: { id: assessmentId }
  });
};
var findAssessmentSubmissions = async (assessmentId) => {
  return await prisma.submission.findMany({
    where: { assessmentId },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          studentProfile: true
        }
      },
      gradedBy: {
        select: { id: true, name: true }
      }
    },
    orderBy: { createdAt: "desc" }
  });
};
var upsertSubmission = async (assessmentId, studentId, submittedUrl) => {
  return await prisma.submission.upsert({
    where: { assessmentId_studentId: { assessmentId, studentId } },
    update: { submittedUrl },
    create: { assessmentId, studentId, submittedUrl }
  });
};
var findSubmissionById = async (submissionId) => {
  return await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { assessment: true }
  });
};
var updateSubmissionGrade = async (submissionId, marks, gradedById) => {
  return await prisma.submission.update({
    where: { id: submissionId },
    data: { marks, gradedById }
  });
};
var bulkUpsertGrades = async (assessmentId, gradedById, grades) => {
  return await prisma.$transaction(
    grades.map(
      (grade) => prisma.submission.upsert({
        where: {
          assessmentId_studentId: { assessmentId, studentId: grade.studentId }
        },
        update: { marks: grade.marks, gradedById },
        create: {
          assessmentId,
          studentId: grade.studentId,
          marks: grade.marks,
          gradedById
        }
      })
    )
  );
};

// src/modules/hub/assessments/assessments.service.ts
var createAssessment2 = async (userId, hubId, data) => {
  await verifyHubRole(userId, hubId, ["TEACHER", "CR", "TA"]);
  return await createAssessment(userId, hubId, data);
};
var getAssessments = async (hubId) => {
  return await findAssessmentsByHubId(hubId);
};
var getAssessmentSubmissions = async (userId, assessmentId) => {
  const assessment = await findAssessmentById(assessmentId);
  if (!assessment) throw new AppError("Assessment not found", 404);
  await verifyHubRole(userId, assessment.hubId, ["TEACHER", "CR", "TA"]);
  return await findAssessmentSubmissions(assessmentId);
};
var submitAssessment = async (userId, assessmentId, submittedUrl) => {
  const assessment = await findAssessmentById(assessmentId);
  if (!assessment) throw new AppError("Assessment not found", 404);
  await verifyHubRole(userId, assessment.hubId, ["STUDENT", "CR", "TA"]);
  return await upsertSubmission(
    assessmentId,
    userId,
    submittedUrl
  );
};
var gradeSubmission = async (userId, submissionId, marks) => {
  const submission = await findSubmissionById(submissionId);
  if (!submission) throw new AppError("Submission not found", 404);
  await verifyHubRole(userId, submission.assessment.hubId, ["TEACHER", "TA"]);
  return await updateSubmissionGrade(
    submissionId,
    marks,
    userId
  );
};
var bulkGrade = async (userId, assessmentId, grades) => {
  const assessment = await findAssessmentById(assessmentId);
  if (!assessment) throw new AppError("Assessment not found", 404);
  await verifyHubRole(userId, assessment.hubId, ["TEACHER", "CR", "TA"]);
  return await bulkUpsertGrades(
    assessmentId,
    userId,
    grades
  );
};

// src/modules/hub/assessments/assessments.controller.ts
var createAssessment3 = catchAsync(
  async (req, res) => {
    const data = await createAssessment2(
      req.user.id,
      req.params.id,
      req.body
    );
    res.status(201).json({ success: true, message: "Assessment created", data });
  }
);
var getAssessments2 = catchAsync(
  async (req, res) => {
    const data = await getAssessments(
      req.params.id
    );
    res.status(200).json({ success: true, data });
  }
);
var submitAssessment2 = catchAsync(
  async (req, res) => {
    const data = await submitAssessment(
      req.user.id,
      req.params.assessmentId,
      req.body.submittedUrl
    );
    res.status(200).json({ success: true, message: "Assignment submitted", data });
  }
);
var gradeSubmission2 = catchAsync(
  async (req, res) => {
    const data = await gradeSubmission(
      req.user.id,
      req.params.submissionId,
      req.body.marks
    );
    res.status(200).json({ success: true, message: "Submission graded", data });
  }
);
var getAssessmentSubmissions2 = catchAsync(
  async (req, res) => {
    const data = await getAssessmentSubmissions(
      req.user.id,
      req.params.assessmentId
    );
    res.status(200).json({ success: true, data });
  }
);
var bulkGrade2 = catchAsync(async (req, res) => {
  const data = await bulkGrade(
    req.user.id,
    req.params.assessmentId,
    req.body
  );
  res.status(200).json({ success: true, message: "Bulk grading complete", data });
});

// src/modules/hub/assessments/assessments.routes.ts
var router16 = Router16({ mergeParams: true });
router16.post(
  "/:id/assessments",
  requireAuth,
  validateRequest(createAssessmentSchema),
  createAssessment3
);
router16.get("/:id/assessments", requireAuth, getAssessments2);
router16.get(
  "/:id/assessments/:assessmentId/submissions",
  requireAuth,
  getAssessmentSubmissions2
);
router16.post(
  "/:id/assessments/:assessmentId/submit",
  requireAuth,
  validateRequest(submitAssessmentSchema),
  submitAssessment2
);
router16.patch(
  "/:id/submissions/:submissionId/grade",
  requireAuth,
  validateRequest(gradeSubmissionSchema),
  gradeSubmission2
);
router16.post(
  "/:id/assessments/:assessmentId/bulk-grade",
  requireAuth,
  validateRequest(bulkGradeSchema),
  bulkGrade2
);
var assessmentRoutes = router16;

// src/modules/hub/reviews/reviews.routes.ts
import { Router as Router17 } from "express";

// src/modules/hub/reviews/reviews.schema.ts
import { z as z18 } from "zod";
var updateReviewSettingsSchema = z18.object({
  body: z18.object({
    isReviewOpen: z18.boolean(),
    reviewQuestions: z18.array(z18.string())
  })
});
var submitReviewSchema = z18.object({
  body: z18.object({
    rating: z18.number().min(1).max(5),
    comment: z18.string().optional(),
    isAnonymous: z18.boolean().default(true),
    answers: z18.any()
    // JSON mapping to custom questions
  })
});

// src/modules/hub/reviews/reviews.repository.ts
var updateHubReviewSettings = async (hubId, data) => {
  return await prisma.courseHub.update({
    where: { id: hubId },
    data: {
      isReviewOpen: data.isReviewOpen,
      reviewQuestions: data.reviewQuestions
    }
  });
};
var findHubById = async (hubId) => {
  return await prisma.courseHub.findUnique({
    where: { id: hubId }
  });
};
var findExistingReview = async (hubId, studentId) => {
  return await prisma.courseReview.findUnique({
    where: { hubId_studentId: { hubId, studentId } }
  });
};
var createCourseReview = async (hubId, studentId, data) => {
  return await prisma.courseReview.create({
    data: {
      hubId,
      studentId,
      rating: data.rating,
      comment: data.comment,
      isAnonymous: data.isAnonymous,
      answers: data.answers
    }
  });
};
var findReviewsByHubId = async (hubId) => {
  return await prisma.courseReview.findMany({
    where: { hubId },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          image: true,
          email: true,
          studentProfile: { select: { studentId: true } }
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });
};

// src/modules/hub/reviews/reviews.service.ts
var updateReviewSettings = async (userId, hubId, data) => {
  await verifyHubRole(userId, hubId, ["TEACHER", "CR", "TA"]);
  return await updateHubReviewSettings(hubId, data);
};
var submitReview = async (userId, hubId, data) => {
  await verifyHubRole(userId, hubId, ["STUDENT", "CR", "TA"]);
  const hub = await findHubById(hubId);
  if (!hub || !hub.isReviewOpen) {
    throw new AppError(
      "Review submission is currently closed for this hub.",
      403
    );
  }
  const existingReview = await findExistingReview(
    hubId,
    userId
  );
  if (existingReview) {
    throw new AppError(
      "You have already submitted a review for this course.",
      409
    );
  }
  return await createCourseReview(hubId, userId, data);
};
var getReviews = async (hubId) => {
  const reviews = await findReviewsByHubId(hubId);
  const totalReviews = reviews.length;
  const averageRating = totalReviews > 0 ? (reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews).toFixed(1) : 0;
  const sanitizedReviews = reviews.map((review) => {
    if (review.isAnonymous) {
      return {
        ...review,
        student: {
          id: "HIDDEN",
          name: "Anonymous Student",
          email: "HIDDEN",
          image: null,
          studentProfile: null
        }
      };
    }
    return review;
  });
  return {
    reviews: sanitizedReviews,
    totalReviews,
    averageRating
  };
};

// src/modules/hub/reviews/reviews.controller.ts
var updateReviewSettings2 = catchAsync(
  async (req, res) => {
    const data = await updateReviewSettings(
      req.user.id,
      req.params.id,
      req.body
    );
    res.status(200).json({ success: true, message: "Review settings updated.", data });
  }
);
var submitReview2 = catchAsync(async (req, res) => {
  const data = await submitReview(
    req.user.id,
    req.params.id,
    req.body
  );
  res.status(201).json({ success: true, message: "Review submitted.", data });
});
var getReviews2 = catchAsync(async (req, res) => {
  const data = await getReviews(req.params.id);
  res.status(200).json({ success: true, data });
});

// src/modules/hub/reviews/reviews.routes.ts
var router17 = Router17({ mergeParams: true });
router17.patch(
  "/:id/review-settings",
  requireAuth,
  validateRequest(updateReviewSettingsSchema),
  updateReviewSettings2
);
router17.post(
  "/:id/reviews",
  requireAuth,
  validateRequest(submitReviewSchema),
  submitReview2
);
router17.get("/:id/reviews", requireAuth, getReviews2);
var reviewRoutes = router17;

// src/modules/hub/hub.routes.ts
var router18 = Router18();
router18.post("/", requireAuth, validateRequest(createHubSchema), createHub);
router18.post("/join", requireAuth, validateRequest(joinHubSchema), joinHub);
router18.get("/teachers", requireAuth, getAvailableTeachers);
router18.get("/my", requireAuth, getMyHubs);
router18.get("/:id", requireAuth, getHubDetails);
router18.patch("/:id", requireAuth, validateRequest(updateHubSchema), updateHub2);
router18.patch(
  "/:id/members/:memberId/role",
  requireAuth,
  validateRequest(updateMemberRoleSchema),
  updateMemberRole
);
router18.delete("/:id/members/:memberId", requireAuth, removeMember);
router18.delete("/:id", requireAuth, deleteHub);
router18.patch(
  "/:id/archive",
  requireAuth,
  validateRequest(archiveHubSchema),
  archiveHub
);
router18.use("/", resourceRoutes);
router18.use("/", contentRoutes);
router18.use("/", assessmentRoutes);
router18.use("/", reviewRoutes);
var hubRoutes = router18;

// src/middleware/rateLimit.middleware.ts
var MAX_ENTRIES = 5e4;
var rateLimit = (options) => {
  const hits = /* @__PURE__ */ new Map();
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of hits.entries()) {
      if (now > record.resetTime) {
        hits.delete(ip);
      }
    }
  }, options.windowMs);
  if (timer.unref) {
    timer.unref();
  }
  return (req, res, next) => {
    const forwardedFor = req.headers["x-forwarded-for"];
    const ip = (typeof forwardedFor === "string" ? forwardedFor.split(",")[0].trim() : req.ip) || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const record = hits.get(ip);
    if (!record || now > record.resetTime) {
      if (hits.size >= MAX_ENTRIES) {
        for (const [key, val] of hits.entries()) {
          if (now > val.resetTime || hits.size >= MAX_ENTRIES) {
            hits.delete(key);
          }
          if (hits.size < MAX_ENTRIES * 0.9) break;
        }
      }
      hits.set(ip, {
        count: 1,
        resetTime: now + options.windowMs
      });
      res.setHeader("X-RateLimit-Limit", options.limit);
      res.setHeader("X-RateLimit-Remaining", options.limit - 1);
      res.setHeader(
        "X-RateLimit-Reset",
        Math.ceil((now + options.windowMs) / 1e3)
      );
      return next();
    }
    record.count++;
    if (record.count > options.limit) {
      const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1e3);
      res.setHeader("Retry-After", retryAfterSeconds);
      res.setHeader("X-RateLimit-Limit", options.limit);
      res.setHeader("X-RateLimit-Remaining", 0);
      res.setHeader("X-RateLimit-Reset", Math.ceil(record.resetTime / 1e3));
      const message = options.message || "Too many requests from this IP, please try again later.";
      res.status(429).json(
        typeof message === "string" ? { success: false, message } : message
      );
      return;
    }
    res.setHeader("X-RateLimit-Limit", options.limit);
    res.setHeader(
      "X-RateLimit-Remaining",
      Math.max(0, options.limit - record.count)
    );
    res.setHeader("X-RateLimit-Reset", Math.ceil(record.resetTime / 1e3));
    next();
  };
};
var globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1e3,
  // 15 minutes
  limit: 100,
  message: {
    success: false,
    message: "Too many requests from this IP, please try again after 15 minutes."
  }
});
var authLimiter = rateLimit({
  windowMs: 15 * 60 * 1e3,
  // 15 minutes
  limit: 100,
  message: {
    success: false,
    message: "Too many authentication attempts, please try again after 15 minutes."
  }
});

// src/app.ts
var app = express();
var parsedTrustedOrigins2 = envConfig.TRUSTED_ORIGINS ? envConfig.TRUSTED_ORIGINS.split(",").map((url) => url.trim()) : [];
var allowedOrigins = [
  envConfig.FRONTEND_URL,
  "smuct-unicompanion://",
  ...parsedTrustedOrigins2
].filter(Boolean);
app.use(
  cors({
    origin: function(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true
  })
);
app.use(globalLimiter);
app.use("/api/auth", authLimiter);
app.all("/api/auth/{*any}", toNodeHandler(auth));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.get("/api/auth/redirect-to-app", (req, res) => {
  const { token, type } = req.query;
  const deepLink = `smuct-unicompanion://${type}?token=${encodeURIComponent(token)}`;
  res.send(`
    <html>
      <body style="font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh;">
        <div style="text-align: center;">
          <p>Redirecting you to the app...</p>
<a href="${deepLink}" style="font-size: 20px; color: blue; padding: 20px; display: block;">
  Click here if you are not redirected automatically.
</a>        </div>
        <script>
          window.location.href = "${deepLink}";
        </script>
      </body>
    </html>
  `);
});
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "SMUCT UniCompanion Engine is online",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.use("/api/students", studentRoutes);
app.use("/api/teachers", teacherRoutes);
app.use("/api/calendars", calendarRoutes);
app.use("/api/buses", busRoutes);
app.use("/api/notices", noticeRoutes);
app.use("/api/users", userRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/forum", forumRoutes);
app.use("/api/blood", bloodRoutes);
app.use("/api/directory", directoryRoutes);
app.use("/api/complaints", complaintRoutes);
app.use("/api/alumni", alumniRoutes);
app.use("/api/field", fieldRoutes);
app.use("/api/hubs", hubRoutes);
app.use(globalErrorHandler);
var app_default = app;

// src/server.ts
var server;
var startServer = async () => {
  try {
    await prisma.$connect();
    console.log("\u2705 PostgreSQL Database connected successfully via Prisma.");
    server = app_default.listen(envConfig.PORT, () => {
      console.log(
        `\u{1F680} SMUCT UniCompanion Backend running on http://localhost:${envConfig.PORT}`
      );
      console.log(
        `\u{1F512} BetterAuth endpoints available at http://localhost:${envConfig.PORT}/api/auth`
      );
    });
  } catch (error) {
    console.error("\u274C Failed to start the server:");
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  }
};
var handleShutdown = async (signal) => {
  console.log(`
\u{1F6D1} Received ${signal}. Starting graceful shutdown...`);
  if (server) {
    server.close(async () => {
      console.log("\u{1F50C} HTTP server closed.");
      await prisma.$disconnect();
      console.log("\u{1F5C4}\uFE0F Database disconnected cleanly.");
      process.exit(0);
    });
  } else {
    await prisma.$disconnect();
    process.exit(0);
  }
};
process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));
startServer();
