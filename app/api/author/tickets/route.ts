import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createTicketSchema = z.object({
  subject: z.string().trim().min(5).max(200),
  description: z.string().trim().min(10).max(10000),
  bookId: z.string().optional(),
});

export async function GET() {
  const session = await getSession();

  try {
    if (!session) {
      return NextResponse.json(
        { success: false, message: "Please log in first." },
        { status: 401 }
      );
    }

    if (session.role !== "AUTHOR") {
      return NextResponse.json(
        { success: false, message: "Author access required." },
        { status: 403 }
      );
    }

    const author = await prisma.author.findUnique({
      where: { userId: session.id },
      select: { id: true },
    });

    if (!author) {
      return NextResponse.json(
        { success: false, message: "Author profile not found." },
        { status: 404 }
      );
    }

    const tickets = await prisma.supportTicket.findMany({
      where: { authorId: author.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        subject: true,
        description: true,
        category: true,
        priority: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        book: {
          select: {
            id: true,
            title: true,
            bookCode: true,
          },
        },
        _count: {
          select: { replies: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      totalTickets: tickets.length,
      tickets: tickets.map((ticket) => ({
        ...ticket,
        replyCount: ticket._count.replies,
        _count: undefined,
      })),
    });
  } catch (error) {
    console.error("Get author tickets API error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to fetch support tickets." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, message: "Please log in first." },
        { status: 401 }
      );
    }

    if (session.role !== "AUTHOR") {
      return NextResponse.json(
        { success: false, message: "Author access required." },
        { status: 403 }
      );
    }

    const body: unknown = await request.json();
    const parsed = createTicketSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid ticket details.",
          errors: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { subject, description, bookId } = parsed.data;

    const author = await prisma.author.findUnique({
      where: { userId: session.id },
      select: { id: true },
    });

    if (!author) {
      return NextResponse.json(
        { success: false, message: "Author profile not found." },
        { status: 404 }
      );
    }

    if (bookId) {
      const book = await prisma.book.findFirst({
        where: { id: bookId, authorId: author.id },
        select: { id: true },
      });

      if (!book) {
        return NextResponse.json(
          {
            success: false,
            message: "Selected book was not found in your account.",
          },
          { status: 400 }
        );
      }
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        authorId: author.id,
        bookId: bookId || null,
        subject,
        description,
        category: "GENERAL",
        priority: "MEDIUM",
        status: "OPEN",
      },
      select: {
        id: true,
        subject: true,
        description: true,
        category: true,
        priority: true,
        status: true,
        bookId: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Support ticket created successfully.",
        ticket,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create ticket API error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to create support ticket." },
      { status: 500 }
    );
  }
}