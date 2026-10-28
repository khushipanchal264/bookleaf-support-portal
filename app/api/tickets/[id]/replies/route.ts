import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const replySchema = z.object({
  message: z.string().trim().min(1).max(5000),
  isInternal: z.boolean().optional().default(false),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function getAccessibleTicket(ticketId: string, userId: string, role: string) {
  return prisma.supportTicket.findFirst({
    where: {
      id: ticketId,
      ...(role === "AUTHOR"
        ? {
            author: {
              userId,
            },
          }
        : {}),
    },
    select: {
      id: true,
      authorId: true,
    },
  });
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, message: "Please log in first." },
        { status: 401 }
      );
    }

    if (session.role !== "AUTHOR" && session.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, message: "Access denied." },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const ticket = await getAccessibleTicket(id, session.id, session.role);

    if (!ticket) {
      return NextResponse.json(
        { success: false, message: "Ticket not found or access denied." },
        { status: 404 }
      );
    }

    const replies = await prisma.ticketReply.findMany({
      where: {
        ticketId: ticket.id,
        ...(session.role === "AUTHOR" ? { isInternal: false } : {}),
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        message: true,
        isInternal: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      totalReplies: replies.length,
      replies,
    });
  } catch (error) {
    console.error("Get ticket replies error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to fetch ticket replies." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, message: "Please log in first." },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    const parsed = replySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid reply. Message must contain 1–5000 characters.",
          errors: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { message, isInternal } = parsed.data;

    if (session.role === "AUTHOR" && isInternal) {
      return NextResponse.json(
        {
          success: false,
          message: "Authors cannot create internal replies.",
        },
        { status: 403 }
      );
    }

    if (session.role !== "AUTHOR" && session.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, message: "Access denied." },
        { status: 403 }
      );
    }

    const ticket = await getAccessibleTicket(id, session.id, session.role);

    if (!ticket) {
      return NextResponse.json(
        { success: false, message: "Ticket not found or access denied." },
        { status: 404 }
      );
    }

    const reply = await prisma.ticketReply.create({
      data: {
        ticketId: ticket.id,
        userId: session.id,
        message,
        isInternal,
      },
      select: {
        id: true,
        ticketId: true,
        message: true,
        isInternal: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Reply added successfully.",
        reply,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create ticket reply error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to add the reply." },
      { status: 500 }
    );
  }
}