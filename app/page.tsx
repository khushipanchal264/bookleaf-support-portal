"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type User = {
  id: string;
  name?: string;
  email: string;
  role: "AUTHOR" | "ADMIN";
};

type Book = {
  id: string;
  title: string;
  bookCode?: string;
  isbn?: string | null;
  royaltyRate?: number | null;
  royalty?: number | null;
  status?: string;
};

type Reply = {
  id: string;
  message: string;
  isInternal: boolean;
  createdAt: string;
  user?: {
    name?: string;
    email?: string;
    role?: string;
  };
};

type Ticket = {
  id: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  author?: {
    name?: string;
    email?: string;
  };
  book?: {
    title?: string;
    bookCode?: string;
  };
  replies?: Reply[];
  replyCount?: number;
  aiCategory?: string;
  aiPriority?: string;
  aiSuggestedResponse?: string;
  assignedTo?: {
    name?: string;
    email?: string;
  } | string | null;
};

type AISuggestion = {
  category: string;
  priority: string;
  suggestedResponse: string;
  confidence: number;
};

type AIResponse = {
  success: boolean;
  source: "openai" | "fallback";
  message: string;
  suggestion: AISuggestion;
};

const CATEGORIES = [
  "ROYALTY",
  "DISTRIBUTION",
  "PRINTING",
  "ISBN",
  "ACCOUNT",
  "GENERAL",
];

const STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_AUTHOR",
  "RESOLVED",
  "CLOSED",
];

const PRIORITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

async function request<T = Record<string, unknown>>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    credentials: "same-origin",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      typeof data.error === "string"
        ? data.error
        : typeof data.message === "string"
          ? data.message
          : `Request failed (${response.status})`,
    );
  }

  return data as T;
}

function pretty(value?: string) {
  if (!value) return "—";

  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dateLabel(value?: string) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function initials(name?: string, email?: string) {
  const source = name || email || "BookLeaf";

  return source
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function statusClass(value?: string) {
  return `badge badge-${(value || "open").toLowerCase().replaceAll("_", "-")}`;
}

function priorityClass(value?: string) {
  return `priority priority-${(value || "medium").toLowerCase()}`;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const [busy, setBusy] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [notice, setNotice] = useState("");
  const [activeSection, setActiveSection] = useState("overview");

  const [books, setBooks] = useState<Book[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState("");
  const [replies, setReplies] = useState<Reply[]>([]);

  const [replyMessage, setReplyMessage] = useState("");
  const [internalReply, setInternalReply] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketDescription, setTicketDescription] = useState("");
  const [ticketCategory, setTicketCategory] = useState("GENERAL");
  const [ticketBookId, setTicketBookId] = useState("");

  const [editStatus, setEditStatus] = useState("");
  const [editPriority, setEditPriority] = useState("");
  const [editCategory, setEditCategory] = useState("");

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId) || null,
    [tickets, selectedTicketId],
  );

  const loadUser = useCallback(async () => {
    try {
      const data = await request<{ user?: User } | User>("/api/auth/me");

      const currentUser =
        "user" in data && data.user ? data.user : (data as User);

      if (currentUser?.id && currentUser?.role) {
        setUser(currentUser);
      }
    } catch {
      setUser(null);
    } finally {
      setBooting(false);
    }
  }, []);

  const loadAuthorData = useCallback(async () => {
    const [bookData, ticketData] = await Promise.all([
      request<{ books?: Book[] } | Book[]>("/api/author/books"),
      request<{ tickets?: Ticket[] } | Ticket[]>("/api/author/tickets"),
    ]);

    const nextBooks = Array.isArray(bookData)
      ? bookData
      : bookData.books || [];

    const nextTickets = Array.isArray(ticketData)
      ? ticketData
      : ticketData.tickets || [];

    setBooks(nextBooks);
    setTickets(nextTickets);
  }, []);

  const loadAdminTickets = useCallback(async () => {
    const params = new URLSearchParams();

    if (search.trim()) params.set("search", search.trim());
    if (statusFilter) params.set("status", statusFilter);
    if (categoryFilter) params.set("category", categoryFilter);
    if (priorityFilter) params.set("priority", priorityFilter);

    const query = params.toString();

    const data = await request<{ tickets?: Ticket[] } | Ticket[]>(
      `/api/admin/tickets${query ? `?${query}` : ""}`,
    );

    const nextTickets = Array.isArray(data) ? data : data.tickets || [];

    setTickets(nextTickets);
  }, [search, statusFilter, categoryFilter, priorityFilter]);

  const loadReplies = useCallback(async (ticketId: string) => {
    if (!ticketId) {
      setReplies([]);
      return;
    }

    try {
      const data = await request<{ replies?: Reply[] } | Reply[]>(
        `/api/tickets/${ticketId}/replies`,
      );

      setReplies(Array.isArray(data) ? data : data.replies || []);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Could not load conversation.",
      );
    }
  }, []);

  const refreshDashboard = useCallback(async () => {
    if (!user) return;

    try {
      if (user.role === "AUTHOR") {
        await loadAuthorData();
      } else {
        await loadAdminTickets();
      }
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Could not load dashboard.",
      );
    }
  }, [user, loadAuthorData, loadAdminTickets]);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  useEffect(() => {
    if (!user) return;

    void refreshDashboard();
  }, [user, refreshDashboard]);

  useEffect(() => {
    if (!selectedTicketId) {
      setReplies([]);
      return;
    }

    void loadReplies(selectedTicketId);
    setReplyMessage("");
    setInternalReply(false);
  }, [selectedTicketId, loadReplies]);

  useEffect(() => {
    if (!notice) return;

    const timer = window.setTimeout(() => setNotice(""), 4000);

    return () => window.clearTimeout(timer);
  }, [notice]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setBusy(true);
    setLoginError("");

    try {
      const data = await request<{ user?: User } | User>(
        "/api/auth/login",
        {
          method: "POST",
          body: JSON.stringify({ email, password }),
        },
      );

      const loggedInUser =
        "user" in data && data.user ? data.user : (data as User);

      if (!loggedInUser?.id || !loggedInUser?.role) {
        throw new Error(
          "Login succeeded, but the user profile was not returned.",
        );
      }

      setUser(loggedInUser);
      setActiveSection("overview");
      setPassword("");

      setNotice(`Welcome back, ${loggedInUser.name || loggedInUser.email}.`);
    } catch (error) {
      setLoginError(
        error instanceof Error ? error.message : "Unable to sign in.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    try {
      await request("/api/auth/logout", { method: "POST" });
    } catch {
      // Clear local UI even if the logout request fails.
    }

    setUser(null);
    setBooks([]);
    setTickets([]);
    setReplies([]);
    setSelectedTicketId("");
    setActiveSection("overview");

    setSearch("");
    setStatusFilter("");
    setCategoryFilter("");
    setPriorityFilter("");
  }

  async function createTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setBusy(true);

    try {
      await request("/api/author/tickets", {
        method: "POST",
        body: JSON.stringify({
          subject: ticketSubject,
          description: ticketDescription,
          category: ticketCategory,
          bookId: ticketBookId || undefined,
        }),
      });

      setTicketSubject("");
      setTicketDescription("");
      setTicketCategory("GENERAL");
      setTicketBookId("");
      setNewTicketOpen(false);

      setNotice("Your support ticket has been created.");

      await loadAuthorData();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Unable to create ticket.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function updateTicket(
    ticketId: string,
    changes: Record<string, string | boolean | null>,
  ) {
    setBusy(true);

    try {
      await request(`/api/admin/tickets/${ticketId}`, {
        method: "PATCH",
        body: JSON.stringify(changes),
      });

      setNotice("Ticket updated successfully.");

      await loadAdminTickets();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Could not update ticket.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function generateAISuggestion(ticketId: string) {
    if (!ticketId || generatingAI) return;

    setGeneratingAI(true);
    setNotice("");

    try {
      const result = await request<AIResponse>(
        `/api/admin/tickets/${ticketId}/ai-suggest`,
        {
          method: "POST",
        },
      );

      if (!result.success || !result.suggestion) {
        throw new Error(
          result.message || "Unable to generate an AI suggestion.",
        );
      }

      const suggestion = result.suggestion;

      // Update the currently displayed ticket immediately.
      setTickets((currentTickets) =>
        currentTickets.map((ticket) =>
          ticket.id === ticketId
            ? {
                ...ticket,
                aiCategory: suggestion.category,
                aiPriority: suggestion.priority,
                aiSuggestedResponse: suggestion.suggestedResponse,
              }
            : ticket,
        ),
      );

      // Populate the admin controls with the AI recommendations.
      setEditCategory(suggestion.category);
      setEditPriority(suggestion.priority);

      // Put the suggested response in the editable reply box.
      setReplyMessage(suggestion.suggestedResponse);
      setInternalReply(false);

      setNotice(
        result.source === "openai"
          ? "AI suggestion generated. Review it before sending."
          : "Fallback suggestion generated. Review it before sending.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to generate an AI suggestion.",
      );
    } finally {
      setGeneratingAI(false);
    }
  }

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedTicketId || !replyMessage.trim()) return;

    setBusy(true);

    try {
      await request(`/api/tickets/${selectedTicketId}/replies`, {
        method: "POST",
        body: JSON.stringify({
          message: replyMessage.trim(),
          isInternal: user?.role === "ADMIN" && internalReply,
        }),
      });

      setReplyMessage("");

      setNotice(internalReply ? "Internal note added." : "Reply sent.");

      await loadReplies(selectedTicketId);

      if (user?.role === "ADMIN") {
        await loadAdminTickets();
      } else {
        await loadAuthorData();
      }
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Could not send reply.",
      );
    } finally {
      setBusy(false);
    }
  }

  const openCount = tickets.filter(
    (ticket) => ticket.status === "OPEN",
  ).length;

  const inProgressCount = tickets.filter(
    (ticket) => ticket.status === "IN_PROGRESS",
  ).length;

  const resolvedCount = tickets.filter((ticket) =>
    ["RESOLVED", "CLOSED"].includes(ticket.status),
  ).length;

  const urgentCount = tickets.filter((ticket) =>
    ["CRITICAL", "HIGH"].includes(ticket.priority),
  ).length;

  if (booting) {
    return (
      <main className="loading-screen">
        <div className="brand-mark">B</div>
        <div className="loading-copy">Preparing your workspace…</div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="login-screen">
        <div className="login-decoration login-decoration-one" />
        <div className="login-decoration login-decoration-two" />

        <section className="login-card">
          <div className="brand-row">
            <div className="brand-mark">B</div>
            <div>
              <div className="brand-name">BookLeaf</div>
              <div className="brand-caption">AUTHOR CARE PORTAL</div>
            </div>
          </div>

          <div className="login-heading">
            <span className="eyebrow">WELCOME BACK</span>
            <h1>Your publishing journey, supported.</h1>
            <p>
              Sign in to manage your books, track support requests and connect
              with the BookLeaf team.
            </p>
          </div>

          <form className="form-stack" onSubmit={handleLogin}>
            <label className="field-label" htmlFor="email">
              Email address
            </label>

            <input
              id="email"
              className="input"
              type="email"
              autoComplete="username"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />

            <label className="field-label" htmlFor="password">
              Password
            </label>

            <input
              id="password"
              className="input"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />

            {loginError && <div className="error-banner">{loginError}</div>}

            <button
              className="button button-primary button-wide"
              disabled={busy}
            >
              {busy ? "Signing in…" : "Sign in to your account"}
              <span aria-hidden="true">→</span>
            </button>
          </form>

          <div className="login-footer">
            <span className="security-dot" />
            Secure access for authors and support administrators
          </div>
        </section>

        <footer className="login-bottom">
          <span>Thoughtfully supporting every story.</span>
          <span>© {new Date().getFullYear()} BookLeaf Publishing</span>
        </footer>
      </main>
    );
  }

  const isAdmin = user.role === "ADMIN";

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark">B</div>
          <div>
            <div className="brand-name">BookLeaf</div>
            <div className="brand-caption">AUTHOR CARE</div>
          </div>
        </div>

        <div className="workspace-label">WORKSPACE</div>

        <nav className="side-nav">
          <button
            className={`nav-item ${
              activeSection === "overview" ? "nav-active" : ""
            }`}
            onClick={() => setActiveSection("overview")}
          >
            <span className="nav-icon">◫</span>
            Overview
          </button>

          <button
            className={`nav-item ${
              activeSection === "tickets" ? "nav-active" : ""
            }`}
            onClick={() => setActiveSection("tickets")}
          >
            <span className="nav-icon">▤</span>
            {isAdmin ? "All support tickets" : "My support tickets"}

            {tickets.length > 0 && (
              <span className="nav-count">{tickets.length}</span>
            )}
          </button>

          {!isAdmin && (
            <button
              className={`nav-item ${
                activeSection === "books" ? "nav-active" : ""
              }`}
              onClick={() => setActiveSection("books")}
            >
              <span className="nav-icon">▥</span>
              My books
            </button>
          )}
        </nav>

        <div className="sidebar-help">
          <div className="help-icon">✳</div>
          <h3>Here for your story.</h3>

          <p>
            {isAdmin
              ? "Keep author conversations helpful, clear and personal."
              : "Our support team is here to help you publish with confidence."}
          </p>

          {!isAdmin && (
            <button
              className="text-button"
              onClick={() => {
                setActiveSection("tickets");
                setNewTicketOpen(true);
              }}
            >
              Contact support <span>↗</span>
            </button>
          )}
        </div>

        <div className="sidebar-user">
          <div className="avatar">{initials(user.name, user.email)}</div>

          <div className="user-details">
            <strong>{user.name || user.email.split("@")[0]}</strong>
            <span>
              {isAdmin ? "Support administrator" : "Author account"}
            </span>
          </div>

          <button
            className="logout-button"
            onClick={() => void handleLogout()}
            title="Sign out"
            aria-label="Sign out"
          >
            ↗
          </button>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <span className="breadcrumb-separator">/</span>

            <strong>
              {activeSection === "overview"
                ? "Overview"
                : activeSection === "books"
                  ? "My books"
                  : isAdmin
                    ? "Support inbox"
                    : "My support tickets"}
            </strong>
          </div>

          <div className="topbar-right">
            <span className="live-indicator" />
            <span className="topbar-status">Workspace active</span>
            <div className="topbar-avatar">
              {initials(user.name, user.email)}
            </div>
          </div>
        </header>

        <div className="page-content">
          {notice && (
            <div className="toast-message" role="status">
              <span>✓</span> {notice}

              <button
                onClick={() => setNotice("")}
                aria-label="Dismiss notification"
              >
                ×
              </button>
            </div>
          )}

          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {isAdmin ? "SUPPORT OPERATIONS" : "YOUR AUTHOR SPACE"}
              </div>

              <h1>
                {activeSection === "overview"
                  ? `Good ${
                      new Date().getHours() < 12
                        ? "morning"
                        : new Date().getHours() < 18
                          ? "afternoon"
                          : "evening"
                    }, ${(user.name || "there").split(" ")[0]}`
                  : activeSection === "books"
                    ? "Your books"
                    : isAdmin
                      ? "Support inbox"
                      : "Your support tickets"}
              </h1>

              <p>
                {isAdmin
                  ? "Every author deserves a timely, thoughtful response."
                  : "Everything you need to keep your publishing journey moving."}
              </p>
            </div>

            {!isAdmin && (
              <button
                className="button button-primary"
                onClick={() => {
                  setActiveSection("tickets");
                  setNewTicketOpen(true);
                }}
              >
                <span>＋</span> Create a ticket
              </button>
            )}

            {isAdmin && (
              <button
                className="button button-secondary"
                disabled={busy}
                onClick={() => void loadAdminTickets()}
              >
                ↻ Refresh inbox
              </button>
            )}
          </div>

          {activeSection === "overview" && (
            <>
              <section className="stats-grid">
                <StatCard
                  label={isAdmin ? "Total tickets" : "My tickets"}
                  value={tickets.length}
                  detail={
                    isAdmin ? "Across all authors" : "All support requests"
                  }
                  icon="▤"
                  tone="violet"
                />

                <StatCard
                  label="Open"
                  value={openCount}
                  detail="Awaiting attention"
                  icon="◷"
                  tone="amber"
                />

                <StatCard
                  label="In progress"
                  value={inProgressCount}
                  detail="Being worked on"
                  icon="↗"
                  tone="blue"
                />

                <StatCard
                  label={isAdmin ? "High priority" : "Resolved"}
                  value={isAdmin ? urgentCount : resolvedCount}
                  detail={
                    isAdmin ? "Critical and high" : "Completed requests"
                  }
                  icon={isAdmin ? "⚑" : "✓"}
                  tone="green"
                />
              </section>

              {!isAdmin && (
                <section className="section-block">
                  <div className="section-heading">
                    <div>
                      <h2>Your publishing catalogue</h2>
                      <p>
                        A quick look at the books linked to your account.
                      </p>
                    </div>

                    <button
                      className="text-button"
                      onClick={() => setActiveSection("books")}
                    >
                      View all books →
                    </button>
                  </div>

                  {books.length === 0 ? (
                    <EmptyState
                      title="No books found"
                      detail="Books linked to your author account will appear here."
                    />
                  ) : (
                    <div className="books-grid">
                      {books.slice(0, 3).map((book, index) => (
                        <BookCard key={book.id} book={book} index={index} />
                      ))}
                    </div>
                  )}
                </section>
              )}

              <section className="section-block">
                <div className="section-heading">
                  <div>
                    <h2>
                      {isAdmin
                        ? "Recent support requests"
                        : "Recent support activity"}
                    </h2>

                    <p>
                      {isAdmin
                        ? "Review requests and take action where needed."
                        : "Stay up to date with your conversations."}
                    </p>
                  </div>

                  <button
                    className="text-button"
                    onClick={() => setActiveSection("tickets")}
                  >
                    View all tickets →
                  </button>
                </div>

                <TicketTable
                  tickets={tickets.slice(0, 5)}
                  isAdmin={isAdmin}
                  selectedId={selectedTicketId}
                  onSelect={(ticket) => {
                    setSelectedTicketId(ticket.id);
                    setActiveSection("tickets");
                    setEditStatus(ticket.status);
                    setEditPriority(ticket.priority);
                    setEditCategory(ticket.category);
                  }}
                />
              </section>
            </>
          )}

          {activeSection === "books" && !isAdmin && (
            <section className="section-block">
              <div className="section-heading">
                <div>
                  <h2>All your books</h2>
                  <p>Your catalogue information available in BookLeaf.</p>
                </div>

                <span className="subtle-count">{books.length} books</span>
              </div>

              {books.length === 0 ? (
                <EmptyState
                  title="Your catalogue is empty"
                  detail="Your books will show up here when linked to your profile."
                />
              ) : (
                <div className="books-grid books-grid-all">
                  {books.map((book, index) => (
                    <BookCard key={book.id} book={book} index={index} />
                  ))}
                </div>
              )}
            </section>
          )}

          {activeSection === "tickets" && (
            <div className="ticket-workspace">
              <section className="ticket-list-panel">
                <div className="panel-heading">
                  <div>
                    <h2>{isAdmin ? "All tickets" : "Your tickets"}</h2>
                    <p>{tickets.length} requests found</p>
                  </div>

                  {!isAdmin && (
                    <button
                      className="icon-button"
                      onClick={() => setNewTicketOpen((value) => !value)}
                      title="Create ticket"
                    >
                      ＋
                    </button>
                  )}
                </div>

                {isAdmin && (
                  <div className="filters">
                    <input
                      className="input filter-search"
                      placeholder="Search tickets or authors…"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />

                    <div className="filter-row">
                      <select
                        className="input"
                        value={statusFilter}
                        onChange={(event) =>
                          setStatusFilter(event.target.value)
                        }
                      >
                        <option value="">All statuses</option>
                        {STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {pretty(status)}
                          </option>
                        ))}
                      </select>

                      <select
                        className="input"
                        value={priorityFilter}
                        onChange={(event) =>
                          setPriorityFilter(event.target.value)
                        }
                      >
                        <option value="">All priorities</option>
                        {PRIORITIES.map((priority) => (
                          <option key={priority} value={priority}>
                            {pretty(priority)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <select
                      className="input"
                      value={categoryFilter}
                      onChange={(event) =>
                        setCategoryFilter(event.target.value)
                      }
                    >
                      <option value="">All categories</option>
                      {CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {pretty(category)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {newTicketOpen && !isAdmin && (
                  <form
                    className="new-ticket-form"
                    onSubmit={createTicket}
                  >
                    <div className="form-title">
                      Create a support request
                    </div>

                    <label className="field-label" htmlFor="ticket-subject">
                      Subject
                    </label>

                    <input
                      id="ticket-subject"
                      className="input"
                      value={ticketSubject}
                      onChange={(event) =>
                        setTicketSubject(event.target.value)
                      }
                      required
                      maxLength={160}
                      placeholder="What do you need help with?"
                    />

                    <label className="field-label" htmlFor="ticket-category">
                      Category
                    </label>

                    <select
                      id="ticket-category"
                      className="input"
                      value={ticketCategory}
                      onChange={(event) =>
                        setTicketCategory(event.target.value)
                      }
                    >
                      {CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {pretty(category)}
                        </option>
                      ))}
                    </select>

                    <label className="field-label" htmlFor="ticket-book">
                      Related book (optional)
                    </label>

                    <select
                      id="ticket-book"
                      className="input"
                      value={ticketBookId}
                      onChange={(event) =>
                        setTicketBookId(event.target.value)
                      }
                    >
                      <option value="">General enquiry / no book</option>

                      {books.map((book) => (
                        <option key={book.id} value={book.id}>
                          {book.title}
                        </option>
                      ))}
                    </select>

                    <label
                      className="field-label"
                      htmlFor="ticket-description"
                    >
                      Description
                    </label>

                    <textarea
                      id="ticket-description"
                      className="input textarea"
                      value={ticketDescription}
                      onChange={(event) =>
                        setTicketDescription(event.target.value)
                      }
                      required
                      minLength={10}
                      placeholder="Tell us a little more so we can help…"
                      rows={4}
                    />

                    <div className="form-actions">
                      <button
                        type="button"
                        className="button button-secondary"
                        onClick={() => setNewTicketOpen(false)}
                      >
                        Cancel
                      </button>

                      <button
                        className="button button-primary"
                        disabled={busy}
                      >
                        {busy ? "Submitting…" : "Submit ticket →"}
                      </button>
                    </div>
                  </form>
                )}

                <TicketTable
                  tickets={tickets}
                  isAdmin={isAdmin}
                  selectedId={selectedTicketId}
                  onSelect={(ticket) => {
                    setSelectedTicketId(ticket.id);
                    setEditStatus(ticket.status);
                    setEditPriority(ticket.priority);
                    setEditCategory(ticket.category);
                  }}
                />
              </section>

              <section className="ticket-detail-panel">
                {!selectedTicket ? (
                  <div className="detail-empty">
                    <div className="detail-empty-icon">▤</div>
                    <h3>Select a support ticket</h3>
                    <p>
                      Choose a request from the list to view its details and
                      conversation.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="detail-header">
                      <div className="detail-ticket-id">
                        TICKET · {selectedTicket.id.slice(-8).toUpperCase()}
                      </div>

                      <div className="detail-title-row">
                        <h2>{selectedTicket.subject}</h2>

                        <span className={statusClass(selectedTicket.status)}>
                          {pretty(selectedTicket.status)}
                        </span>
                      </div>

                      <p className="detail-meta">
                        Created {dateLabel(selectedTicket.createdAt)}
                        {selectedTicket.author?.name
                          ? ` · ${selectedTicket.author.name}`
                          : ""}
                      </p>
                    </div>

                    <div className="detail-tags">
                      <span className="category-chip">
                        {pretty(selectedTicket.category)}
                      </span>

                      <span className={priorityClass(selectedTicket.priority)}>
                        {pretty(selectedTicket.priority)} priority
                      </span>

                      {selectedTicket.book?.title && (
                        <span className="category-chip">
                          ▥ {selectedTicket.book.title}
                        </span>
                      )}
                    </div>

                    <div className="ticket-description">
                      <div className="conversation-avatar">
                        {initials(
                          selectedTicket.author?.name,
                          selectedTicket.author?.email,
                        )}
                      </div>

                      <div className="conversation-content">
                        <div className="conversation-byline">
                          <strong>
                            {selectedTicket.author?.name ||
                              (isAdmin ? "Author" : user.name || "You")}
                          </strong>

                          <span>
                            {dateLabel(selectedTicket.createdAt)}
                          </span>
                        </div>

                        <p>{selectedTicket.description}</p>
                      </div>
                    </div>

                    {isAdmin && (
                      <div className="admin-controls">
                        <div className="form-title">Manage ticket</div>

                        <div className="form-actions">
                          <button
                            type="button"
                            className="button button-primary"
                            disabled={busy || generatingAI}
                            onClick={() =>
                              void generateAISuggestion(selectedTicket.id)
                            }
                          >
                            {generatingAI
                              ? "Generating suggestion…"
                              : "✳ Generate AI Suggestion"}
                          </button>
                        </div>

                        <div className="admin-control-grid">
                          <div>
                            <label
                              className="field-label"
                              htmlFor="edit-status"
                            >
                              Status
                            </label>

                            <select
                              id="edit-status"
                              className="input"
                              value={editStatus}
                              onChange={(event) =>
                                setEditStatus(event.target.value)
                              }
                            >
                              {STATUSES.map((status) => (
                                <option key={status} value={status}>
                                  {pretty(status)}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label
                              className="field-label"
                              htmlFor="edit-priority"
                            >
                              Priority
                            </label>

                            <select
                              id="edit-priority"
                              className="input"
                              value={editPriority}
                              onChange={(event) =>
                                setEditPriority(event.target.value)
                              }
                            >
                              {PRIORITIES.map((priority) => (
                                <option key={priority} value={priority}>
                                  {pretty(priority)}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="control-full">
                            <label
                              className="field-label"
                              htmlFor="edit-category"
                            >
                              Category
                            </label>

                            <select
                              id="edit-category"
                              className="input"
                              value={editCategory}
                              onChange={(event) =>
                                setEditCategory(event.target.value)
                              }
                            >
                              {CATEGORIES.map((category) => (
                                <option key={category} value={category}>
                                  {pretty(category)}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="form-actions admin-actions">
                          <button
                            type="button"
                            className="button button-secondary"
                            disabled={busy}
                            onClick={() =>
                              void updateTicket(selectedTicket.id, {
                                assignToMe: true,
                              })
                            }
                          >
                            Assign to me
                          </button>

                          <button
                            type="button"
                            className="button button-secondary"
                            disabled={busy}
                            onClick={() =>
                              void updateTicket(selectedTicket.id, {
                                unassign: true,
                              })
                            }
                          >
                            Unassign
                          </button>

                          <button
                            type="button"
                            className="button button-primary"
                            disabled={busy}
                            onClick={() =>
                              void updateTicket(selectedTicket.id, {
                                status: editStatus,
                                priority: editPriority,
                                category: editCategory,
                              })
                            }
                          >
                            Save changes
                          </button>
                        </div>

                        {selectedTicket.aiSuggestedResponse && (
                          <div className="ai-suggestion">
                            <div className="ai-label">
                              ✳ AI SUPPORT SUGGESTION
                            </div>

                            <div className="admin-control-grid">
                              <div>
                                <span className="field-label">
                                  Suggested category
                                </span>

                                <span className="category-chip">
                                  {pretty(selectedTicket.aiCategory)}
                                </span>
                              </div>

                              <div>
                                <span className="field-label">
                                  Suggested priority
                                </span>

                                <span
                                  className={priorityClass(
                                    selectedTicket.aiPriority,
                                  )}
                                >
                                  {pretty(selectedTicket.aiPriority)}
                                </span>
                              </div>
                            </div>

                            <p>{selectedTicket.aiSuggestedResponse}</p>

                            <button
                              type="button"
                              className="text-button"
                              onClick={() => {
                                setReplyMessage(
                                  selectedTicket.aiSuggestedResponse || "",
                                );
                                setInternalReply(false);
                              }}
                            >
                              Use suggested response →
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="conversation-section">
                      <div className="conversation-heading">
                        <h3>Conversation</h3>
                        <span>{replies.length} messages</span>
                      </div>

                      <div className="reply-list">
                        {replies.length === 0 ? (
                          <div className="conversation-empty">
                            No replies yet. Start the conversation below.
                          </div>
                        ) : (
                          replies.map((reply) => (
                            <div
                              className={`reply-item ${
                                reply.isInternal ? "reply-internal" : ""
                              }`}
                              key={reply.id}
                            >
                              <div className="conversation-avatar reply-avatar">
                                {initials(
                                  reply.user?.name,
                                  reply.user?.email,
                                )}
                              </div>

                              <div className="conversation-content">
                                <div className="conversation-byline">
                                  <strong>
                                    {reply.user?.name ||
                                      reply.user?.email ||
                                      "BookLeaf Support"}
                                  </strong>

                                  <span>{dateLabel(reply.createdAt)}</span>
                                </div>

                                {reply.isInternal && (
                                  <div className="internal-label">
                                    INTERNAL NOTE · ADMIN ONLY
                                  </div>
                                )}

                                <p>{reply.message}</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      <form className="reply-form" onSubmit={sendReply}>
                        {isAdmin && (
                          <label className="internal-toggle">
                            <input
                              type="checkbox"
                              checked={internalReply}
                              onChange={(event) =>
                                setInternalReply(event.target.checked)
                              }
                            />

                            <span>
                              Internal note (only visible to admins)
                            </span>
                          </label>
                        )}

                        <textarea
                          className="input textarea reply-textarea"
                          rows={3}
                          placeholder={
                            internalReply
                              ? "Add a private internal note…"
                              : "Write a thoughtful response…"
                          }
                          value={replyMessage}
                          onChange={(event) =>
                            setReplyMessage(event.target.value)
                          }
                          required
                        />

                        <div className="reply-form-footer">
                          <span>Be clear, kind and specific.</span>

                          <button
                            className="button button-primary"
                            disabled={busy || !replyMessage.trim()}
                          >
                            {busy
                              ? "Sending…"
                              : internalReply
                                ? "Add internal note"
                                : "Send reply →"}
                          </button>
                        </div>
                      </form>
                    </div>
                  </>
                )}
              </section>
            </div>
          )}

          <footer className="page-footer">
            <span>BookLeaf Author Care</span>
            <span>Every story matters. Every author counts.</span>
          </footer>
        </div>
      </section>
    </main>
  );
}

function StatCard({
  label,
  value,
  detail,
  icon,
  tone,
}: {
  label: string;
  value: number;
  detail: string;
  icon: string;
  tone: string;
}) {
  return (
    <article className="stat-card">
      <div className={`stat-icon stat-${tone}`}>{icon}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-detail">{detail}</div>
    </article>
  );
}

function BookCard({ book, index }: { book: Book; index: number }) {
  const palettes = [
    "cover-plum",
    "cover-sage",
    "cover-ochre",
    "cover-blue",
  ];

  const royaltyRate = book.royaltyRate ?? book.royalty;

  return (
    <article className="book-card">
      <div className={`book-cover ${palettes[index % palettes.length]}`}>
        <span className="cover-emblem">✳</span>

        <div className="cover-lines">
          <span />
          <span />
          <span />
        </div>

        <div className="cover-bottom">BOOKLEAF EDITION</div>
      </div>

      <div className="book-info">
        <div className="book-code">
          {book.bookCode || book.isbn || "BOOK CATALOGUE"}
        </div>

        <h3>{book.title}</h3>

        <div className="book-metadata">
          <span>Royalty rate</span>

          <strong>
            {typeof royaltyRate === "number"
              ? `${royaltyRate}%`
              : "See agreement"}
          </strong>
        </div>

        <div className="book-status">
          <span className="security-dot" />
          {pretty(book.status || "ACTIVE")}
        </div>
      </div>
    </article>
  );
}

function TicketTable({
  tickets,
  isAdmin,
  selectedId,
  onSelect,
}: {
  tickets: Ticket[];
  isAdmin: boolean;
  selectedId?: string;
  onSelect: (ticket: Ticket) => void;
}) {
  if (!tickets.length) {
    return (
      <EmptyState
        title="Nothing to show yet"
        detail={
          isAdmin
            ? "Try adjusting the filters or search terms."
            : "When you create a support ticket, it will appear here."
        }
      />
    );
  }

  return (
    <div className="ticket-table">
      {tickets.map((ticket) => (
        <button
          type="button"
          className={`ticket-row ${
            selectedId === ticket.id ? "ticket-row-selected" : ""
          }`}
          key={ticket.id}
          onClick={() => onSelect(ticket)}
        >
          <div className="ticket-row-main">
            <div className="ticket-row-title">
              <strong>{ticket.subject}</strong>

              <span className={priorityClass(ticket.priority)}>
                {pretty(ticket.priority)}
              </span>
            </div>

            <p>{ticket.description}</p>

            <div className="ticket-row-meta">
              <span>
                {isAdmin
                  ? ticket.author?.name || ticket.author?.email || "Author"
                  : ticket.book?.title || pretty(ticket.category)}
              </span>

              <span>·</span>
              <span>{dateLabel(ticket.createdAt)}</span>
            </div>
          </div>

          <div className="ticket-row-end">
            <span className={statusClass(ticket.status)}>
              {pretty(ticket.status)}
            </span>

            <span className="ticket-arrow">↗</span>
          </div>
        </button>
      ))}
    </div>
  );
}

function EmptyState({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">✳</div>
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  );
}