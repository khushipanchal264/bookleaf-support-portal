import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const statusValues = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_AUTHOR",
  "RESOLVED",
  "CLOSED",
] as const;

const categoryValues = [
  "ROYALTY",
  "DISTRIBUTION",
  "PRINTING",
  "ISBN",
  "ACCOUNT",
  "GENERAL",
] as const;

const priorityValues = [
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
] as const;

export async function GET(request: Request) {
  const session = await getSession();

  try {
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

    const { searchParams } = new URL(request.url);

    const statusParam = searchParams.get("status");
    const categoryParam = searchParams.get("category");
    const priorityParam = searchParams.get("priority");
    const search = searchParams.get("search")?.trim();

    const filters: {
      status?: (typeof statusValues)[number];
      category?: (typeof categoryValues)[number];
      priority?: (typeof priorityValues)[number];
    } = {};

    if (statusParam) {
      const result = z.enum(statusValues).safeParse(statusParam);

      if (!result.success) {
        return NextResponse.json(
          { success: false, message: "Invalid status filter." },
          { status: 400 }
        );
      }

      filters.status = result.data;
    }

    if (categoryParam) {
      const result = z.enum(categoryValues).safeParse(categoryParam);

      if (!result.success) {
        return NextResponse.json(
          { success: false, message: "Invalid category filter." },
          { status: 400 }
        );
      }

      filters.category = result.data;
    }

    if (priorityParam) {
      const result = z.enum(priorityValues).safeParse(priorityParam);

      if (!result.success) {
        return NextResponse.json(
          { success: false, message: "Invalid priority filter." },
          { status: 400 }
        );
      }

      filters.priority = result.data;
    }

    const tickets = await prisma.supportTicket.findMany({
      where: {
        ...filters,
        ...(search
          ? {
              OR: [
                {
                  subject: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
                {
                  description: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
                {
                  author: {
                    user: {
                      name: {
                        contains: search,
                        mode: "insensitive",
                      },
                    },
                  },
                },
                {
                  author: {
                    user: {
                      email: {
                        contains: search,
                        mode: "insensitive",
                      },
                    },
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: [
        { priority: "asc" },
        { createdAt: "desc" },
      ],
      select: {
        id: true,
        subject: true,
        description: true,
        category: true,
        priority: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        aiCategory: true,
        aiPriority: true,
        aiSuggestedResponse: true,
        aiConfidence: true,
        author: {
          select: {
            authorCode: true,
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
        book: {
          select: {
            id: true,
            title: true,
            bookCode: true,
          },
        },
        _count: {
          select: {
            replies: true,
          },
        },
      },
    });

    const counts = await prisma.supportTicket.groupBy({
      by: ["status"],
      _count: { _all: true },
    });

    return NextResponse.json({
      success: true,
      totalTickets: tickets.length,
      statusCounts: Object.fromEntries(
        counts.map((item) => [item.status, item._count._all])
      ),
      tickets: tickets.map((ticket) => ({
        ...ticket,
        replyCount: ticket._count.replies,
        _count: undefined,
      })),
    });
  } catch (error) {
    console.error("Admin ticket queue API error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to fetch the admin ticket queue." },
      { status: 500 }
    );
  }
}