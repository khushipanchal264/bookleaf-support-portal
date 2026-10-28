import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateTicketSchema = z
  .object({
    status: z
      .enum([
        "OPEN",
        "IN_PROGRESS",
        "WAITING_FOR_AUTHOR",
        "RESOLVED",
        "CLOSED",
      ])
      .optional(),

    priority: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).optional(),

    category: z
      .enum([
        "ROYALTY",
        "DISTRIBUTION",
        "PRINTING",
        "ISBN",
        "ACCOUNT",
        "GENERAL",
      ])
      .optional(),

    assignToMe: z.boolean().optional(),
    unassign: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.status !== undefined ||
      data.priority !== undefined ||
      data.category !== undefined ||
      data.assignToMe === true ||
      data.unassign === true,
    { message: "Provide at least one field to update." }
  )
  .refine(
    (data) => !(data.assignToMe === true && data.unassign === true),
    { message: "Cannot assign and unassign a ticket simultaneously." }
  );

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, message: "Please log in first." },
        { status: 401 }
      );
    }

    if (session.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, message: "Admin access required." },
        { status: 403 }
      );
    }

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Ticket ID is required." },
        { status: 400 }
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    const parsed = updateTicketSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid ticket update.",
          errors: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const existingTicket = await prisma.supportTicket.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingTicket) {
      return NextResponse.json(
        { success: false, message: "Ticket not found." },
        { status: 404 }
      );
    }

    const input = parsed.data;

    const updateData: {
      status?: "OPEN" | "IN_PROGRESS" | "WAITING_FOR_AUTHOR" | "RESOLVED" | "CLOSED";
      priority?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
      category?: "ROYALTY" | "DISTRIBUTION" | "PRINTING" | "ISBN" | "ACCOUNT" | "GENERAL";
      assignedTo?: string | null;
    } = {};

    if (input.status !== undefined) updateData.status = input.status;
    if (input.priority !== undefined) updateData.priority = input.priority;
    if (input.category !== undefined) updateData.category = input.category;

    if (input.assignToMe === true) {
      updateData.assignedTo = session.id;
    } else if (input.unassign === true) {
      updateData.assignedTo = null;
    }

    const ticket = await prisma.supportTicket.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        subject: true,
        category: true,
        priority: true,
        status: true,
        assignedTo: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Ticket updated successfully.",
      ticket,
    });
  } catch (error) {
    console.error("Admin ticket update API error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to update the ticket." },
      { status: 500 }
    );
  }
}