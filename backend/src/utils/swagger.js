const swaggerJsdoc = require("swagger-jsdoc");

const spec = swaggerJsdoc({
  definition: {
    openapi: "3.0.3",
    info: {
      title: "MediConnect API",
      version: "1.0.0",
      description:
        "Hospital Management System REST API — auth, appointments, doctors, and more.",
    },
    servers: [{ url: "/api/v1", description: "Current environment" }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        // ── Shared ──────────────────────────────────────────────────────────
        Error: {
          type: "object",
          properties: {
            message: { type: "string" },
            requestId: { type: "string" },
          },
        },
        User: {
          type: "object",
          properties: {
            id: { type: "integer" },
            fullName: { type: "string" },
            email: { type: "string", format: "email" },
            phone: { type: "string", nullable: true },
            role: { type: "string", enum: ["admin", "doctor", "patient", "receptionist"] },
            status: { type: "string" },
            avatarUrl: { type: "string", nullable: true },
            hospitalId: { type: "integer" },
            hospitalCode: { type: "string" },
            hospitalSlug: { type: "string" },
            hospitalName: { type: "string" },
          },
        },
        // ── Auth ────────────────────────────────────────────────────────────
        RegisterBody: {
          type: "object",
          required: ["fullName", "email", "password"],
          properties: {
            hospitalCode: { type: "string", example: "MCH-BLR" },
            fullName: { type: "string", example: "Jane Doe" },
            email: { type: "string", format: "email", example: "jane@example.com" },
            password: { type: "string", format: "password", minLength: 8 },
            phone: { type: "string", nullable: true },
            dateOfBirth: { type: "string", format: "date", nullable: true },
            gender: {
              type: "string",
              enum: ["male", "female", "other", "undisclosed"],
              nullable: true,
            },
          },
        },
        LoginBody: {
          type: "object",
          required: ["email", "password"],
          properties: {
            hospitalCode: { type: "string", example: "MCH-BLR" },
            email: { type: "string", format: "email", example: "admin@mediconnect.local" },
            password: { type: "string", format: "password", example: "Password@123" },
          },
        },
        AuthResponse: {
          type: "object",
          properties: {
            accessToken: { type: "string" },
            user: { $ref: "#/components/schemas/User" },
          },
        },
        // ── Doctors ─────────────────────────────────────────────────────────
        Doctor: {
          type: "object",
          properties: {
            id: { type: "integer" },
            userId: { type: "integer" },
            fullName: { type: "string" },
            email: { type: "string" },
            specialization: { type: "string" },
            department: { type: "string", nullable: true },
            consultationFeeCents: { type: "integer" },
          },
        },
        AvailabilityRule: {
          type: "object",
          properties: {
            id: { type: "integer" },
            weekday: { type: "integer", minimum: 0, maximum: 6 },
            startTime: { type: "string", example: "09:00" },
            endTime: { type: "string", example: "17:00" },
            slotMinutes: { type: "integer", example: 30 },
          },
        },
        // ── Appointments ────────────────────────────────────────────────────
        Appointment: {
          type: "object",
          properties: {
            id: { type: "integer" },
            patientId: { type: "integer" },
            doctorId: { type: "integer" },
            patientName: { type: "string" },
            doctorName: { type: "string" },
            scheduledStart: { type: "string", format: "date-time" },
            scheduledEnd: { type: "string", format: "date-time" },
            status: {
              type: "string",
              enum: [
                "scheduled",
                "confirmed",
                "checked_in",
                "in_consultation",
                "completed",
                "cancelled",
                "no_show",
              ],
            },
            priority: {
              type: "string",
              enum: ["routine", "urgent", "emergency"],
            },
            appointmentType: { type: "string" },
            consultationMode: { type: "string" },
            reason: { type: "string", nullable: true },
            queueNumber: { type: "integer", nullable: true },
          },
        },
        BookAppointmentBody: {
          type: "object",
          required: ["doctorId"],
          properties: {
            doctorId: { type: "integer" },
            patientId: { type: "integer", nullable: true, description: "Required for staff bookings" },
            startsAt: { type: "string", format: "date-time" },
            appointmentType: { type: "string", default: "consultation" },
            consultationMode: { type: "string", enum: ["in_person", "video", "phone"], default: "in_person" },
            reason: { type: "string", nullable: true },
            priority: { type: "string", enum: ["routine", "urgent", "emergency"], default: "routine" },
            waitingListRequested: { type: "boolean", default: false },
          },
        },
        UpdateStatusBody: {
          type: "object",
          required: ["status"],
          properties: {
            status: {
              type: "string",
              enum: ["confirmed", "checked_in", "in_consultation", "completed", "cancelled", "no_show"],
            },
            cancellationReason: { type: "string", nullable: true },
          },
        },
        RescheduleBody: {
          type: "object",
          required: ["startsAt"],
          properties: {
            startsAt: { type: "string", format: "date-time" },
          },
        },
      },
    },
    // ── Global security (all routes require Bearer unless overridden) ──────
    security: [{ bearerAuth: [] }],
    paths: {
      // ══════════════════════════════════════════════════════════════════════
      // AUTH
      // ══════════════════════════════════════════════════════════════════════
      "/auth/register": {
        post: {
          tags: ["Auth"],
          summary: "Register a new patient account",
          security: [],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/RegisterBody" } } },
          },
          responses: {
            201: {
              description: "Account created",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      message: { type: "string" },
                      user: { $ref: "#/components/schemas/User" },
                    },
                  },
                },
              },
            },
            400: { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            409: { description: "Email already exists", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/auth/login": {
        post: {
          tags: ["Auth"],
          summary: "Sign in and receive access token",
          security: [],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/LoginBody" } } },
          },
          responses: {
            200: {
              description: "Signed in successfully",
              headers: {
                "Set-Cookie": {
                  schema: { type: "string" },
                  description: "HttpOnly refresh_token cookie",
                },
              },
              content: { "application/json": { schema: { $ref: "#/components/schemas/AuthResponse" } } },
            },
            401: { description: "Invalid credentials", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/auth/refresh": {
        post: {
          tags: ["Auth"],
          summary: "Refresh access token using HttpOnly cookie",
          security: [],
          responses: {
            200: { description: "New access token", content: { "application/json": { schema: { $ref: "#/components/schemas/AuthResponse" } } } },
            401: { description: "Invalid or expired refresh token", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/auth/logout": {
        post: {
          tags: ["Auth"],
          summary: "Revoke refresh token and clear cookie",
          responses: {
            204: { description: "Logged out" },
          },
        },
      },
      "/auth/me": {
        get: {
          tags: ["Auth"],
          summary: "Get current authenticated user",
          responses: {
            200: {
              description: "Current user",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { user: { $ref: "#/components/schemas/User" } },
                  },
                },
              },
            },
            401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },

      // ══════════════════════════════════════════════════════════════════════
      // DOCTORS
      // ══════════════════════════════════════════════════════════════════════
      "/doctors": {
        get: {
          tags: ["Doctors"],
          summary: "List all doctors in the hospital",
          responses: {
            200: {
              description: "Doctor list",
              content: {
                "application/json": {
                  schema: { type: "array", items: { $ref: "#/components/schemas/Doctor" } },
                },
              },
            },
            401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/doctors/me/availability": {
        get: {
          tags: ["Doctors"],
          summary: "Get own availability rules (doctor / admin / receptionist)",
          responses: {
            200: {
              description: "Availability rules",
              content: {
                "application/json": {
                  schema: { type: "array", items: { $ref: "#/components/schemas/AvailabilityRule" } },
                },
              },
            },
            403: { description: "Forbidden", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
        put: {
          tags: ["Doctors"],
          summary: "Replace own availability rules",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["rules"],
                  properties: {
                    rules: {
                      type: "array",
                      items: {
                        type: "object",
                        required: ["weekday", "startTime", "endTime", "slotMinutes"],
                        properties: {
                          weekday: { type: "integer", minimum: 0, maximum: 6 },
                          startTime: { type: "string", example: "09:00" },
                          endTime: { type: "string", example: "17:00" },
                          slotMinutes: { type: "integer", example: 30 },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: "Rules updated", content: { "application/json": { schema: { type: "object" } } } },
            400: { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            403: { description: "Forbidden", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/doctors/me/time-off": {
        get: {
          tags: ["Doctors"],
          summary: "List own time-off entries",
          responses: {
            200: {
              description: "Time-off list",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "integer" },
                        startsAt: { type: "string", format: "date-time" },
                        endsAt: { type: "string", format: "date-time" },
                        reason: { type: "string", nullable: true },
                      },
                    },
                  },
                },
              },
            },
            403: { description: "Forbidden", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
        post: {
          tags: ["Doctors"],
          summary: "Add a time-off block",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["startsAt", "endsAt"],
                  properties: {
                    startsAt: { type: "string", format: "date-time" },
                    endsAt: { type: "string", format: "date-time" },
                    reason: { type: "string", nullable: true },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: "Time-off created" },
            400: { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            403: { description: "Forbidden", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/doctors/{doctorId}/availability": {
        get: {
          tags: ["Doctors"],
          summary: "Get a specific doctor's availability rules",
          parameters: [
            { name: "doctorId", in: "path", required: true, schema: { type: "integer" } },
          ],
          responses: {
            200: {
              description: "Availability rules",
              content: {
                "application/json": {
                  schema: { type: "array", items: { $ref: "#/components/schemas/AvailabilityRule" } },
                },
              },
            },
            401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },

      // ══════════════════════════════════════════════════════════════════════
      // APPOINTMENTS
      // ══════════════════════════════════════════════════════════════════════
      "/appointments": {
        get: {
          tags: ["Appointments"],
          summary: "List appointments scoped to the authenticated user's role",
          parameters: [
            { name: "date", in: "query", schema: { type: "string", format: "date" }, description: "Filter by date (YYYY-MM-DD)" },
            { name: "status", in: "query", schema: { type: "string" }, description: "Filter by status" },
          ],
          responses: {
            200: {
              description: "Appointment list",
              content: {
                "application/json": {
                  schema: { type: "array", items: { $ref: "#/components/schemas/Appointment" } },
                },
              },
            },
            401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
        post: {
          tags: ["Appointments"],
          summary: "Book a new appointment",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/BookAppointmentBody" } } },
          },
          responses: {
            201: {
              description: "Appointment booked (or waitlist created)",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      appointment: { $ref: "#/components/schemas/Appointment" },
                      payment: { type: "object" },
                      waitlist: { type: "object", nullable: true },
                    },
                  },
                },
              },
            },
            400: { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            409: { description: "Slot conflict", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/appointments/queue": {
        get: {
          tags: ["Appointments"],
          summary: "Get today's consultation queue (doctor / admin)",
          parameters: [
            { name: "date", in: "query", schema: { type: "string", format: "date" } },
          ],
          responses: {
            200: {
              description: "Queue",
              content: {
                "application/json": {
                  schema: { type: "array", items: { $ref: "#/components/schemas/Appointment" } },
                },
              },
            },
            401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/appointments/waitlist": {
        get: {
          tags: ["Appointments"],
          summary: "List waitlist entries",
          responses: {
            200: { description: "Waitlist entries", content: { "application/json": { schema: { type: "array", items: { type: "object" } } } } },
            403: { description: "Forbidden", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
        post: {
          tags: ["Appointments"],
          summary: "Create a waitlist entry (patient / admin / receptionist)",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["doctorId", "preferredDate"],
                  properties: {
                    doctorId: { type: "integer" },
                    patientId: { type: "integer", nullable: true },
                    preferredDate: { type: "string", format: "date" },
                    preferredWindow: { type: "string", example: "09:00" },
                    priority: { type: "string", enum: ["routine", "urgent", "emergency"], default: "routine" },
                    reason: { type: "string", nullable: true },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: "Waitlist entry created" },
            400: { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/appointments/{id}/reschedule": {
        patch: {
          tags: ["Appointments"],
          summary: "Reschedule an appointment",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "integer" } },
          ],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/RescheduleBody" } } },
          },
          responses: {
            200: { description: "Rescheduled", content: { "application/json": { schema: { $ref: "#/components/schemas/Appointment" } } } },
            404: { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            409: { description: "Slot conflict", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/appointments/{id}/status": {
        patch: {
          tags: ["Appointments"],
          summary: "Update appointment status (confirm, check-in, cancel, complete…)",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "integer" } },
          ],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateStatusBody" } } },
          },
          responses: {
            200: { description: "Status updated", content: { "application/json": { schema: { $ref: "#/components/schemas/Appointment" } } } },
            403: { description: "Forbidden", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            404: { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
    },
  },
  apis: [], // all definitions are inline above
});

module.exports = spec;
