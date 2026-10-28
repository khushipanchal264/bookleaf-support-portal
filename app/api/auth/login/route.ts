
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().trim().email("Valid email is required."),
  password: z.string().min(1, "Password is required."),
});

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();

    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Please enter a valid email and password.",
        },
        { status: 400 }
      );
    }

    const email = parsed.data.email.toLowerCase();
    const { password } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        passwordHash: true,
        role: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid email or password.",
        },
        { status: 401 }
      );
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!passwordMatches) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid email or password.",
        },
        { status: 401 }
      );
    }

    if (user.role !== "AUTHOR" && user.role !== "ADMIN") {
      return NextResponse.json(
        {
          success: false,
          message: "This account does not have an allowed role.",
        },
        { status: 403 }
      );
    }

    await createSession({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });

    return NextResponse.json({
      success: true,
      message: "Login successful.",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "An unexpected error occurred during login.",
      },
      { status: 500 }
    );
  }
}
