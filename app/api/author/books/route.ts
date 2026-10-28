
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();

  try {
    if (!session) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized. Please log in.",
        },
        { status: 401 }
      );
    }

    if (session.role !== "AUTHOR") {
      return NextResponse.json(
        {
          success: false,
          message: "Only authors can access this resource.",
        },
        { status: 403 }
      );
    }

    const author = await prisma.author.findUnique({
      where: { userId: session.id },
      select: {
        id: true,
        authorCode: true,
        books: {
          orderBy: { title: "asc" },
          select: {
            id: true,
            bookCode: true,
            title: true,
            isbn: true,
            genre: true,
            publicationDate: true,
            status: true,
            mrp: true,
            totalCopiesSold: true,
            totalRoyalties: true,
            royaltyPaid: true,
            royaltyPending: true,
            lastRoyaltyPayoutDate: true,
            printPartner: true,
            availableOn: true,
          },
        },
      },
    });

    if (!author) {
      return NextResponse.json(
        {
          success: false,
          message: "Author profile not found.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      author: {
        id: author.id,
        authorCode: author.authorCode,
      },
      totalBooks: author.books.length,
      books: author.books.map((book) => ({
        ...book,
        mrp: book.mrp?.toString() ?? null,
        royaltyPaid: book.royaltyPaid.toString(),
        royaltyPending: book.royaltyPending.toString(),
      })),
    });
  } catch (error) {
    console.error("Author books API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to fetch author books.",
      },
      { status: 500 }
    );
  }
}
