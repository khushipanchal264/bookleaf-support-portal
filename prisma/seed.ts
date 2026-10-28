import { PrismaClient } from "../app/generated/prisma/client";
import bcrypt from "bcryptjs";
import sampleData from "../bookleaf_sample_data.json";

const prisma = new PrismaClient();

const DEFAULT_AUTHOR_PASSWORD =
  process.env.SEED_DEFAULT_PASSWORD || "BookLeaf@123";

const ADMIN_EMAIL =
  process.env.ADMIN_EMAIL || "admin@bookleaf.com";

const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD || "Admin@BookLeaf123";

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

async function main() {
  console.log("Starting BookLeaf database seeding...");

  const authorPasswordHash = await bcrypt.hash(
    DEFAULT_AUTHOR_PASSWORD,
    12
  );

  const adminPasswordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  // Create or update the admin account.
  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      name: "BookLeaf Admin",
      passwordHash: adminPasswordHash,
      role: "ADMIN",
    },
    create: {
      name: "BookLeaf Admin",
      email: ADMIN_EMAIL,
      passwordHash: adminPasswordHash,
      role: "ADMIN",
    },
  });

  console.log(`Admin account ready: ${ADMIN_EMAIL}`);

  let authorCount = 0;
  let bookCount = 0;

  for (const authorData of sampleData.authors) {
    // Create or update the author's login account.
    const user = await prisma.user.upsert({
      where: {
        email: authorData.email,
      },
      update: {
        name: authorData.name,
        passwordHash: authorPasswordHash,
        role: "AUTHOR",
      },
      create: {
        name: authorData.name,
        email: authorData.email,
        passwordHash: authorPasswordHash,
        role: "AUTHOR",
      },
    });

    // Create or update the author profile.
    const author = await prisma.author.upsert({
      where: {
        userId: user.id,
      },
      update: {
        authorCode: authorData.author_id,
        phone: authorData.phone || null,
        city: authorData.city || null,
        joinedDate: toDate(authorData.joined_date),
      },
      create: {
        userId: user.id,
        authorCode: authorData.author_id,
        phone: authorData.phone || null,
        city: authorData.city || null,
        joinedDate: toDate(authorData.joined_date),
      },
    });

    authorCount++;

    // Import this author's books.
    for (const bookData of authorData.books ?? []) {
      await prisma.book.upsert({
        where: {
          bookCode: bookData.book_id,
        },
        update: {
          authorId: author.id,
          title: bookData.title,
          isbn: bookData.isbn || null,
          genre: bookData.genre || null,
          publicationDate: toDate(bookData.publication_date),
          status: bookData.status || "Unknown",
          mrp: bookData.mrp ?? null,
          royaltyPerCopy: bookData.author_royalty_per_copy ?? null,
          totalCopiesSold: bookData.total_copies_sold ?? 0,
          totalRoyalties: bookData.total_royalty_earned ?? 0,
          royaltyPaid: bookData.royalty_paid ?? 0,
          royaltyPending: bookData.royalty_pending ?? 0,
          lastRoyaltyPayoutDate: toDate(
            bookData.last_royalty_payout_date
          ),
          printPartner: bookData.print_partner || null,
          availableOn: bookData.available_on ?? [],
        },
        create: {
          authorId: author.id,
          bookCode: bookData.book_id,
          title: bookData.title,
          isbn: bookData.isbn || null,
          genre: bookData.genre || null,
          publicationDate: toDate(bookData.publication_date),
          status: bookData.status || "Unknown",
          mrp: bookData.mrp ?? null,
          royaltyPerCopy: bookData.author_royalty_per_copy ?? null,
          totalCopiesSold: bookData.total_copies_sold ?? 0,
          totalRoyalties: bookData.total_royalty_earned ?? 0,
          royaltyPaid: bookData.royalty_paid ?? 0,
          royaltyPending: bookData.royalty_pending ?? 0,
          lastRoyaltyPayoutDate: toDate(
            bookData.last_royalty_payout_date
          ),
          printPartner: bookData.print_partner || null,
          availableOn: bookData.available_on ?? [],
        },
      });

      bookCount++;
    }

    console.log(
      `Imported ${authorData.name}: ${authorData.books?.length ?? 0} books`
    );
  }

  const totalAuthors = await prisma.author.count();
  const totalBooks = await prisma.book.count();

  console.log("\nDatabase seeding completed!");
  console.log(`Authors processed: ${authorCount}`);
  console.log(`Books processed: ${bookCount}`);
  console.log(`Total author profiles in database: ${totalAuthors}`);
  console.log(`Total books in database: ${totalBooks}`);

  console.log("\nDemo login credentials:");
  console.log(`Admin email: ${ADMIN_EMAIL}`);
  console.log(`Admin password: ${ADMIN_PASSWORD}`);
  console.log(`Author password: ${DEFAULT_AUTHOR_PASSWORD}`);
  console.log("Use an email from bookleaf_sample_data.json for author login.");
}

main()
  .catch((error) => {
    console.error("Database seeding failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });